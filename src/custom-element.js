import container from './di';

import { Document } from './dom';

export class CustomElementProperty {
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

    splice() {
        if (Array.isArray(this.value)) {
            this._oldValue = this._cloneValue(this._value);
            this._value.splice(...arguments);
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

export class CustomElement extends HTMLElement {
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
            Document.cleanNode(this.elementRef);

            this._init = true;
        }

        this.update();

        if (this.onConnected) {
            this.onConnected();
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
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

    requestUpdate(oldValue, newValue) {
        if (oldValue !== newValue) {
            this.update();
        }
    }

    update() {
        if (null !== this.elementRef) {
            this.elementRef.dispatchEvent(new CustomEvent('changes', { detail: this.scope }));
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

    dispatchEvent(event) {
        return this.elementRef.element.host.dispatchEvent(event);
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
