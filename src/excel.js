import XJSRunnerFactory from "./libs/v2.js";
import XJSMapper from "./libs/XJSMapper.js";
import mappings from "./model/mapping.json";
import model from "./model/model.json";
// import cache    from './model/cache.json';

class Excel {
	constructor() {
		const xjs = XJSRunnerFactory.create(model);

		// xjs.loadCalculationQueuesCache(cache);

		this.mapper = new XJSMapper({
			xjs,
			mappings
		});
	}

	get(path) {
		console.log(path);

		return this.mapper.get(path);
	}

	set(obj) {
		const data = obj;

		this.mapper.set(data);
	}
	recompute(cb) {
		this.mapper.recompute(cb);
	}
}

export default new Excel();
