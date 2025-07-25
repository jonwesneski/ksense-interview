import get_patients from './get_patients_example.json'

type PatientsDataType = typeof get_patients['data']


const API_KEY = process.env.API_KEY as string

const run = async () => {
    const patients = await fetchData()
    const alertList = createAlertList(patients)
    console.log(patients, alertList)
    const response = await postAlertList(alertList)
    console.log(await response.json())
}

const fetchData = async (): Promise<PatientsDataType> => {
    const patients: PatientsDataType = [] 
    let response: Response | undefined = undefined
    let page = 1
    let hasNext = true
    let retries = 0
    while (hasNext && retries < 10) {
        response = await fetch(
            `https://assessment.ksensetech.com/api/patients?page=${page}&limit=10`,
            {headers: {'x-api-key': API_KEY}}
        )
        if (!response.ok) {
            retries++
            continue
        }

        const jsonResponse = await response?.json()
        hasNext = jsonResponse?.pagination?.hasNext ?? false
        page++
        if (jsonResponse.data) {
            patients.push(...jsonResponse.data)
        }
    }
    return patients
}

const createAlertList = (patients: PatientsDataType) => {
    const highRiskPatients: string[] = []
    const feverPatients: string[] = []
    const dataQualityIssues: string[] = []

    for (const patient of patients) {
        const bpScore = calculateBpScore(patient.blood_pressure)
        const tempScore = calculateTemperatureScore(patient.temperature)
        const ageScore = calculateAgeScore(patient.age)
        if (bpScore === undefined || tempScore === undefined || ageScore === undefined) {
            dataQualityIssues.push(patient.patient_id)
            continue
        }

        const totalScore = bpScore + tempScore + ageScore
        if (totalScore >= 4) {
            highRiskPatients.push(patient.patient_id)
        }

        if (tempScore > 0) {
            feverPatients.push(patient.patient_id)
        }
    }

    return {
        "high_risk_patients": highRiskPatients,
        "fever_patients": feverPatients,
        "data_quality_issues": dataQualityIssues
    }
}

const calculateBpScore = (bloodPressure: string) => {
    if (typeof bloodPressure !== 'string') {
        return undefined
    }
    const [systolic, diastolic] = bloodPressure.split('/')
    const [systolicInt, diastolicInt] = [parseInt(systolic), parseInt(diastolic)]
    if (!isNumber(systolicInt)|| !isNumber(diastolicInt)) {
        return undefined
    }

    if (systolicInt < 120 && diastolicInt < 80) {
        return 0
    }
    if (systolicInt >= 120 && systolicInt <= 129 && diastolicInt < 80) {
        return 1
    }
    if (systolicInt >= 130 && systolicInt <= 139 ||
         diastolicInt >= 80 && diastolicInt <= 89) {
        return 2
    }
    if (systolicInt >=140 || diastolicInt >= 90) {
        return 3
    }
}

const calculateTemperatureScore = (temperature: number) => {
    if (!isNumber(temperature)) {
        return undefined
    }

    if (temperature <= 99.5) {
        return 0
    }
    if (temperature >= 99.6 && temperature <= 100.9) {
        return 1
    } 
    if (temperature >= 101) {
        return 2
    }
}

const calculateAgeScore = (age: number) => {
    if (!isNumber(age)) {
        return undefined
    }

    if (age < 40) {
        return 0
    }
    if (age >=40 && age <=65) {
        return 1
    }
    if (age > 65) {
        return 2
    }
}

const isNumber = (value: unknown) => {
    return typeof value === 'number' && !Number.isNaN(value)
}

const postAlertList = async (alerts: ReturnType<typeof createAlertList>) => {
    return await fetch(
        `https://assessment.ksensetech.com/api/submit-assessment`,
        {
            method: 'POST',
            headers: {
                'x-api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(alerts)
        }
    )
}

run()