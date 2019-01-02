class Container {
	constructor() {
		this._items = {};
	}

	get(key) {
		if (typeof key === 'function') {
			key = key.name;
		} else if (typeof key === 'object') {
			key = key.constructor.name;
		}

		if (!this._items[key]) {
			return null;
		}

		const service = this._items[key];
		if (service.instance) {
			return service.instance;
		}

		if (typeof service.object === 'function') {
			this._items[key].instance = new service.object(...service.parameters.map(p => this.get(p)));
		} else {
			this._items[key].instance = service.object;
		}

		return service.instance;
	}

	has(key) {
		if (typeof key === 'function') {
			key = key.name;
		} else if (typeof key === 'object') {
			key = key.constructor.name;
		}

		return !!this._items[key];
	}

	add(key, value, parameters) {
		if (typeof key === 'function') {
			key = key.name;
		} else if (typeof key === 'object') {
			key = key.constructor.name;
		}

		if (!this.has(key)) {
			this._items[key] = { object: value, parameters };
		}
	}
}

class Injectable {
	static get injects() {
		return [];
	}
}

module.exports = { Injectable, container: new Container() };
