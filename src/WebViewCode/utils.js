import excelEngine from "./excel";

export function getDataToSet(initPath, data) {
    return data instanceof Object
        ? fillNestedData(initPath, data)
        : { [initPath]: data };
}


export function fillNestedData(prefix, data) {
    const result = {};

    if (data.length) {
        data.forEach((value, index) => {
            if (typeof value === Object && !value.length) fillNestedData(result, `${prefix}/${index}`, value);
            else result[`${prefix}/${index}`] = value;
        });
    } else {
        for (const key in data) {
            if (typeof data[key] === Object && !data[key].length) fillNestedData(result, `${prefix}/${key}`, data[key]);
            else result[`${prefix}/${key}`] = data[key];
        }
    }

    return result;
}

export function setInputsValue(prefix, inputsData) {
    const dataToSet = getDataToSet(prefix, inputsData);
    return updateModel(dataToSet);
}

export async function setParametersValue(prefix, inputsData) {
    const dataToSet = getDataToSet(prefix, inputsData);
    const data = await updateModel(dataToSet);

    return data.inputs.sensitivity;
}

export function updateModel(dataToSet) {
    return new Promise((resolve) => {
        excelEngine.set(dataToSet);
        excelEngine.recompute(() => {
            resolve(excelEngine.get('/'));
        });
    });
}

export function deepClone(data) {
    return JSON.parse(JSON.stringify(data));
}