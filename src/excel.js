import XJSRunnerFactory from './libs/v2.js';
import XJSMapper        from './libs/XJSMapper.js';
import mappings         from './model/mapping.json';
import model            from './model/model.json';
import cache            from './model/cache.js';

class Excel {
    constructor() {
        const xjs = XJSRunnerFactory.create(model);

        xjs.loadCalculationQueuesCache(cache);

        this.mapper = new XJSMapper({
            xjs,
            mappings
        });
    }

    get(path) {
        return this.mapper.get(path);
    }

    set(data) {
        this.mapper.set(data);
    }

    recompute(cb) {
        this.mapper.recompute(() => {
			console.log('recompute')
			cb();
		});
    }
}

export default new Excel();
