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

const container = new Container();

class Node {
    constructor(element, parent, children) {
        this.element = element;
        this.parent = parent;
        this.children = children;

        this.customAttributes = [];
        if (this.element.attributes) {
            for (let i = 0; i < this.element.attributes.length; i++) {
                if (this.element.attributes[i].name.match(/\[(\S)+\]/g)) {
                    this.customAttributes.push(this.element.attributes[i]);
                }
            }

            this.customAttributes.forEach(attribute => this.element.removeAttribute(attribute.name));
        }
    }

    dispatchEvent(event) {
        let name;
        this.customAttributes.forEach(attribute => {
            const levels = attribute.name.replace('[', '').replace(']', '').split('.');
            const value = this.parseExpression('return ' + attribute.value, event.detail);
            this.applyCustomAttribute(this.element, levels, value);
        });

        this.children.forEach(node => node.dispatchEvent(event));
    }

    parseExpression(expression, scope = {}) {
        const f = new Function(...(Object.keys(scope).concat([expression])));
        return f(...(Object.values(scope)));
    }

    applyCustomAttribute(element, attributeNames, value) {
        switch (attributeNames[0]) {
            case 'innerhtml':
                element.innerHTML = value;
                break;
            case 'style':
                element.style[attributeNames[1]] = value;
                break;
            case 'class':
                value ? element.classList.add(attributeNames[1]) : element.classList.remove(attributeNames[1]);
                break;
            case 'attribute':
            case 'attr':
                element.setAttribute(attributeNames[1], value);
                break;
            default:
                element[attributeNames[0]] = value;
        }
    }

	clone() {
		return Document.cloneNode(this, this.element.cloneNode(true), this.parent, this.customAttributes);
	}
}

class IfNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = this.element.getAttribute('if');
        this.mask = document.createTextNode('');
        this.hidden = false;
    }

    dispatchEvent(event) {
        var result = this.parseExpression('return ' + this.if, event.detail);

        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.dispatchEvent(event);
        } else if (!this.hidden) {
            super.dispatchEvent(event);
        }
    }
}

class ForNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.for = this.element.getAttribute('for').match(/(?:var|let)\s+(\S+)\s+(?:in|of)\s+(\S+)/);
        this.mask = document.createTextNode('');
		this.clone = this.clone();
		this.clone.element.removeAttribute('for');
        this.children = [];

        this.parent.replaceChild(this.mask, this.element);
    }

    dispatchEvent(event) {
        this.children.forEach(child => {
            if (Array.from(this.parent.children).indexOf(child.element) !== -1) {
                this.parent.removeChild(child.element);
            }
        });

        this.children = [];

        const self = this;
        function iteration(el, els) {
            const index = els.indexOf(el);
			const clone = self.clone.clone();
            const scope = {};

			scope[self.for[1]] = els[index];
            scope['$index'] = index;

            self.parent.insertBefore(clone.element, self.mask);

            clone.dispatchEvent(new CustomEvent(event.type, { detail: scope }));

            self.children.push(clone);
        }

        this.parseExpression(
            'for (' + this.for[0] + ') { iteration(' + this.for[1] + ', ' + this.for[2] + '); }',
            Object.assign({}, event.detail, { iteration })
        );
    }
}

class Document {
    static createElement(element, parent) {
        const children = [];
        for (let i = 0; i < element.children.length; i++) {
        	if (element.children[i].hasAttribute) {
            	children.push(Document.createElement(element.children[i], element));
            }
        }

        if (element.hasAttribute && element.hasAttribute('for') && element.tagName !== 'LABEL') {
            return new ForNode(element, parent, children);
        }

        if (element.hasAttribute && element.hasAttribute('if')) {
            return new IfNode(element, parent, children);
        }

        return new Node(element, parent, children);
    }

	static cloneNode(node, element, parent, customAttributes = []) {
		const clone = new Node(element, parent);
		clone.customAttributes = customAttributes;

		const children = [];
		node.children.forEach((n, i) => {
			children.push(Document.cloneNode(n, clone.element.children[i], clone.element, n.customAttributes));
		});

		clone.children = children;

		return clone;
	}
}

class CustomElementProperty {
    constructor(name, callback) {
    	this.name = name;
        this._value = undefined;
        this._oldValue = undefined;
        this.callback = callback;
    }

    push(item) {
    	if (Array.isArray(this.value)) {
        	this._oldValue = this._cloneValue(this._value);
        	this._value.push(item);
            this.callback(this._oldValue, this._value);
        }
    }

	bind(element, event = 'change') {
		element.addEventListener(event, e => this.value = e.target.value);
	}

    set value(value) {
        this._oldValue = this._cloneValue(this._value);
        this._value = value;

        this.callback(this._oldValue, this._value);
    }

    get value() {
        return this._value;
    }

    _cloneValue() {
		if (Array.isArray(this.value)) {
        	return [].concat(this.value);
        } else if (typeof this.value === 'object') {
        	return Object.assign({}, this.value);
        }

        return this.value;
    }

    get scope() {
    	const data = {};

        data[this.name] = this.value;

        return data;
    }
}

class Injectable {
    static get injects() {
    	return [];
    }
}

class CustomElement extends HTMLElement {
    constructor() {
        super();

        this.constructor.properties.forEach(property => {
            this[property] = new CustomElementProperty(property, (oldValue, newValue) => this.requestUpdate(oldValue, newValue));
        });

		this.constructor.observedAttributes.forEach(property => {
			this[property] = new CustomElementProperty(property, (oldValue, newValue) => this.requestUpdate(oldValue, newValue));
		});

		this._init = false;
        this._container = container;
        this.constructor.injects.forEach(inject => {
        	this._container.add(inject, inject, inject.injects || []);
        });

        this.elementRef = null;
    }

    connectedCallback() {
		if (!this._init) {
			const styles = !Array.isArray(this.constructor.styles) ? [this.constructor.styles] : this.constructor.styles;
            const style = styles.join("\n");
			const template = document.createElement('template');

            if (null !== this.constructor.template && typeof this.constructor.template === 'string') {
            	template.innerHTML = `<style>${style}</style>${this.constructor.template}`;
            } else if (this.constructor.template instanceof HTMLTemplateElement) {
            	template.innerHTML = `<style>${style}</style>${this.constructor.template.content.textContent}`;
            } else {
            	template.innerHTML = `<style>${style}</style><slot></slot>`;
            }

	        this.attachShadow({ mode: 'open' });
	        this.shadowRoot.appendChild(template.content.cloneNode(true));

	        this.elementRef = Document.createElement(this.shadowRoot, this.shadowRoot.host);
			this._init = true;
		}

        this.update();

        if (this.onConnected) {
            this.onConnected();
        }
    }

	attributeChangedCallback(name, oldValue, newValue) {
		if (this.onChanges) {
            this.onChanges(name, oldValue, newValue);
        }

		this[name].value = newValue;
	}

	disconnectedCallback() {
		if (this.onDisconnected) {
            this.onDisconnected();
        }
	}

    requestUpdate(oldValue, newValue) {
        if (oldValue !== newValue) {
        	this.update();
        }
    }

    update() {
    	if (null !== this.elementRef) {
        	this.elementRef.dispatchEvent(new CustomEvent('changes', { detail: this.scope }));
        }
    }

    get(key) {
        return this._container.get(key);
    }

    has(key) {
        return this._container.has(key);
    }

    on(event, callback, options = false) {
        this.elementRef.element.addEventListener(event, callback, options);
    }

    element(selector) {
        const el = this.elementRef.element.querySelector(selector);

        if (el && !el.on) {
            el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
        }

        return el;
    }

    get scope() {
    	return Object.assign({}, ...([].concat(this.constructor.properties, this.constructor.observedAttributes).filter(p => !!this[p]).map(p => this[p].scope)));
    }

    static get properties() {
        return [];
    }

    static get injects() {
    	return [];
    }

    static get observedAttributes() {
        return [];
    }

    static get template() {
        return null;
    }

	static get styles() {
		return [];
	}
}

class Router extends Injectable {
	constructor() {
		super();

		this.routes = [];
		this.params = [];

		if (!window.location.hash) {
	        window.location.hash = '#/';
	    }

		window.addEventListener("hashchange", () => this._matchRoute());
	}

	add(routes) {
		if (!Array.isArray(routes)) {
			routes = [routes];
		}

		routes.forEach(route => this.routes.push(route));

		this._matchRoute();
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
