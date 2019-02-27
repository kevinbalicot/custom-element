import { Injectable } from './di';

class Router extends Injectable {
	constructor() {
		super();

		this.routes = [];
		this.params = {};

		window.addEventListener("hashchange", () => this._matchRoute());
	}

	add(routes) {
		if (!Array.isArray(routes)) {
			routes = [routes];
		}

		routes.forEach(route => this.routes.push(route));

		if (!window.location.hash) {
			window.location.hash = '#/';
		} else {
			this._matchRoute();
		}
	}

	_matchRoute() {
		this.routes.forEach(route => {
			const routePath = `^${route.path}$`;
			const keys = routePath.match(/:(\w+)\(.+\)|:(\w+)/g) || [];

			let pattern = routePath.replace(/\//g, '\\/');
			pattern = pattern.replace(/:\w+(\(.+\))/g, '$1');
			pattern = pattern.replace(/:(\w+)/g, '((?:(?!\\/)[\\W\\w_])+)');

			const regexp = new RegExp(pattern, 'g');
			const values = regexp.exec(window.location.hash.replace("#", ""));

			if (null !== values) {
				this.params = {};
				keys.forEach((key, index) => {
					key = key.replace(/:(\w+)\(.+\)|:(\w+)/g, '$1$2').trim();
					this.params[key] = decodeURIComponent(values[index + 1] || null);
				});

				const activate = undefined != route.activate ? route.activate : () => true;
				Promise.resolve(activate()).then(result => {
					if (result) {
						route.container.innerHTML = null;
						route.container.appendChild(document.createElement(route.component));
					}
				});
			}
		});
	}
}

module.exports = { Router };
