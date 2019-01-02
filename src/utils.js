import { Injectable } from './di';

class Router extends Injectable {
	constructor() {
		super();

		this.routes = [];
		this.params = [];

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
		let params;
		let activate;
		this.routes.forEach(route => {
			params = window.location.hash.replace("#", "").match(new RegExp(`^${route.path}$`));
			activate = undefined != route.activate ? route.activate : () => true;
			if (params) {
				this.params = params.map(el => decodeURIComponent(el));
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
