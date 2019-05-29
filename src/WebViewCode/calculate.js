import excelEngine from './excel.js';
import { setInputsValue, setParametersValue, deepClone } from './utils';

const RANDOMIZE_EMPTY_DATA = new Array(2200).fill([]).map(() => new Array(10).fill(''));

export default async function calculate() {
    await setInputsValue('', {
        'inputs/sensitivity/modelRuns' : 5
    });
    const { modelRuns, seedValue, runAction } = excelEngine.get('inputs/sensitivity');
    const seed = Math.round(seedValue);
    const runs = +modelRuns;

    const getRandom = () => {                        // eslint-disable-line
        const x = Math.sin(seed) * 10000;

        return x - Math.floor(x);
    };
    const { res1, res2, res3, res4, res5, res6, parametersRandomDiapazon } = runAction;
    const resultsValues = [ res1, res2, res3, res4, res5, res6 ];
    const RANDOMIZE_VALUES = deepClone(RANDOMIZE_EMPTY_DATA);

    await setInputsValue('', {
        'inputs/sensitivity/runAction/modelRuns'            : runs,
        'inputs/sensitivity/runAction/resultsValuesDiapazon': [ resultsValues ],
        'inputs/sensitivity/runAction/parametersFlag'       : 'TRUE'
    });

    for (let i = 0; i < runs; i++) {         // eslint-disable-line
        const parameters = parametersRandomDiapazon.map(() => [ getRandom() ]);
        const updatedInputs = await setParametersValue('', {
            'inputs/sensitivity/runAction/parametersRandomDiapazon': parameters
        });

        const { res1, res2, res3, res4, res5, res6 } = updatedInputs.runAction;          // eslint-disable-line
        const fieldData = [ i + 1, '', res1, res2, res3, res4, res5, res6 ];

        RANDOMIZE_VALUES[i] = fieldData;
    }

    await setInputsValue('', {
        'inputs/sensitivity/runAction/randomizeData' : RANDOMIZE_VALUES,
        'inputs/sensitivity/runAction/parametersFlag': 'FALSE'
    });
}
