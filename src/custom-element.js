const { container } = require('./di');
const { Document } = require('./dom');

class CustomElementProperty {
    constructor(name, callback, links = []) {
        this.name = name;
        this._value = undefined;
        this._oldValue = undefined;
        this.callback = callback;
        this.links = links;
    }

    push() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value.push(...arguments);
            this.callback(this, this._oldValue, this._value);
        }
    }

    splice() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value.splice(...arguments);
            this.callback(this, this._oldValue, this._value);
        }
    }

    pop() {
        let result = null;
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            result = this._value.pop();
            this.callback(this, this._oldValue, this._value);
        }

        return result;
    }

    shift() {
        let result = null;
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            result = this._value.shift();
            this.callback(this, this._oldValue, this._value);
        }

        return result;
    }

    map() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value = this.value.map(...arguments);
            this.callback(this, this._oldValue, this._value);
        }
    }

    concat() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value = this.value.concat(...arguments);
            this.callback(this, this._oldValue, this._value);
        }
    }

    reverse() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value = this.value.reverse();
            this.callback(this, this._oldValue, this._value);
        }
    }

    toggle() {
        if (true === this.value || false === this.value) {
            this._oldValue = this._cloneValue(this._value);
            this._value = !this.value;
            this.callback(this, this._oldValue, this._value);
        }
    }

    add(number) {
        if (typeof this.value === 'number') {
            this._oldValue = this._cloneValue(this._value);
            this._value += number;
            this.callback(this, this._oldValue, this._value);
        }
    }

    bind(element, event = 'change') {
        element.addEventListener(event, e => this.value = e.target.value);
    }

    set value(value) {
        this._oldValue = this._cloneValue(this._value);
        this._value = value;

        this.callback(this, this._oldValue, this._value);
    }

    get value() {
        return this._value;
    }

    get length() {
        return this.value.length;
    }

    get scope() {
        const data = {};

        data[this.name] = this.value;

        return data;
    }

    _cloneValue() {
        if (Array.isArray(this.value)) {
            return [].concat(this.value);
        } else if (typeof this.value === 'object') {
            return Object.assign({}, this.value);
        }

        return this.value;
    }
}

class CustomElement extends HTMLElement {
    constructor() {
        super();

        this.constructor.properties.forEach(property => {
            let name = property;
            let links = [];
            if (typeof property === 'object') {
                name = property.name;
                links = property.links;
            }

            this[name] = new CustomElementProperty(name, (property, oldValue, newValue) => this.requestUpdate(property, oldValue, newValue), links);
        });

        this.constructor.observedAttributes.forEach(property => {
            let name = property;
            let links = [];
            if (typeof property === 'object') {
                name = property.name;
                links = property.links;
            }

            this[name] = new CustomElementProperty(name, (property, oldValue, newValue) => this.requestUpdate(property, oldValue, newValue), links);
        });

        this._init = false;
        this._container = container;
        this._timer = null;
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
            Document.cleanNode(this.elementRef);

            this._init = true;
        }

        this.update();

        if (this.onConnected) {
            this.onConnected();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        try {
            oldValue = JSON.parse(oldValue);
        } catch (e) {}

        try {
            newValue = JSON.parse(newValue);
        } catch (e) {}

        if (oldValue === newValue) {
            return;
        }

        this[name].value = newValue;

        if (this.onChanges) {
            this.onChanges(name, oldValue, newValue);
        }
    }

    disconnectedCallback() {
        if (this.onDisconnected) {
            this.onDisconnected();
        }
    }

    requestUpdate(property, oldValue, newValue) {
        if (oldValue !== newValue) {
            if (property.links.length > 0 && null !== this.elementRef) {
                property.links.forEach(link => this.update(this.element(link)));
            } else {
                clearTimeout(this._timer);
                this._timer = setTimeout(() => this.update());
            }
        }
    }

    update(element = null) {
        if (null !== element && null !== this.elementRef) {
            Document.searchNode(element, this.elementRef).update(this.scope, this);
            Document.cleanNode(this.elementRef);
        } else if (null !== this.elementRef) {
            this.elementRef.update(this.scope, this);
            Document.cleanNode(this.elementRef);
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

    emit(event) {
        return this.elementRef.element.host.dispatchEvent(event);
    }

    get scope() {
        const properties = this.constructor.properties.map(element => typeof element === 'object' ? element.name : element);
        const observedAttributes = this.constructor.observedAttributes.map(element => typeof element === 'object' ? element.name : element);

        return Object.assign({}, ...([].concat(properties, observedAttributes).filter(p => !!this[p]).map(p => this[p].scope)));
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

module.exports = { CustomElementProperty, CustomElement };
