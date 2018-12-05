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

        var service = this._items[key];

        if (service.instance) {
            return service.instance;
        }

        this._items[key].instance = new service.object(...service.parameters.map(p => this.get(p)));

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
        //this.customAttributeValues = [];

        for (let i = 0; i < this.element.attributes.length; i++) {
            if (this.element.attributes[i].name.match(/\[(\S)+\]/g)) {
                this.customAttributes.push(this.element.attributes[i]);
                //this.customAttributeValues.push(this.element.attributes[i].value);
            }
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
            default:
                element[attributeNames[0]] = value;
        }
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

        var self = this;

        function iteration(el, els) {
            const index = els.indexOf(el);
            const scope = {};
            const elementClone = self.element.cloneNode(true);
            elementClone.removeAttribute('for');

            self.parent.insertBefore(elementClone, self.mask);

            scope[self.for[1]] = els[index];
            scope['$index'] = index;

            var node = Document.createElement(elementClone, self.parent);
            node.dispatchEvent(new CustomEvent(event.type, {
                detail: scope
            }));

            self.children.push(node);
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
            children.push(Document.createElement(element.children[i], element));
        }

        if (element.hasAttribute('for') && element.tagName !== 'LABEL') {
            return new ForNode(element, parent, children);
        }

        if (element.hasAttribute('if')) {
            return new IfNode(element, parent, children);
        }

        return new Node(element, parent, children);
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

        this._container = container;
        this.constructor.injects.forEach(inject => {
        	this._container.add(inject, inject, inject.injects || []);
        });

        this.innerHTML = this.constructor.template;
        this.elementRef = null;
    }

    connectedCallback() {
        const template = document.createElement('template');
        template.innerHTML = '<style></style><slot></slot>';

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.elementRef = Document.createElement(this.shadowRoot.host, this.shadowRoot.host);
        this.update();

        if (this.onConnected) {
            this.onConnected();
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
    	return Object.assign({}, ...(this.constructor.properties.map(property => this[property].scope)));
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
}

function router(routes) {
    if (!Array.isArray(routes)) {
        routes = [routes];
    }

    if (!window.location.hash) {
        window.location.hash = '#/';
    }

    function matchRoute() {
        routes.forEach(route => {
            if (window.location.hash.replace("#", "").match(new RegExp(`^${route.path}$`))) {
                route.container.innerHTML = null;
                route.container.appendChild(document.createElement(route.component));
            }
        });
    };

    window.addEventListener("hashchange", function() {
        matchRoute();
    });

    matchRoute();
};
