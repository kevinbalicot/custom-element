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
		} else if (!service.object) {
			return service;
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
		} else if (typeof key === 'string') {
			this._items[key] = value;
		}

		if (!this.has(key)) {
			this._items[key] = { object: value, parameters };
		}
	}

	get items() {
		return this._items;
	}

	get scope() {
		let scope = {};
		for (let key in this._items) {
			scope[key] = this.get(key);
		}

		return scope;
	}
}

class Injectable {
	static get injects() {
		return [];
	}
}

module.exports = { Injectable, container: new Container() };
