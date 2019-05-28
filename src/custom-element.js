const { container } = require('./di');
const { render } = require('./vdom');

class CustomElement extends HTMLElement {
    constructor() {
        super();

        this._init = false;
        this._container = container;
        this._style = null;

        this.constructor.injects.forEach(inject => {
            this._container.add(inject, inject, inject.injects || []);
        });
    }

    connectedCallback() {
        if (!this._init) {
            const styles = !Array.isArray(this.constructor.styles) ? [this.constructor.styles] : this.constructor.styles;

            this._style = document.createElement('style');
            this._style.innerHTML = styles.join("\n");

            this.attachShadow({ mode: 'open' });

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

        if (this[name] === newValue) {
            return;
        }

        this[name] = newValue;

        if (this.onChanges) {
            this.onChanges(name, oldValue, newValue);
        }
    }

    disconnectedCallback() {
        if (this.onDisconnected) {
            this.onDisconnected();
        }
    }

    update(details = {}) {
        for (let prop in details) {
            if (undefined !== this[prop]) {
                this[prop] = details[prop];
            }
        }

        render(this.shadowRoot, `${this._style.outerHTML}${this.template}`, this);
    }

    get(key) {
        return this._container.get(key);
    }

    set(key, value, parameters = []) {
        this._container.add(key, value, parameters);
    }

    has(key) {
        return this._container.has(key);
    }

    on(event, callback, options = false) {
        this.shadowRoot.addEventListener(event, callback, options);

        return this;
    }

    element(selector) {
        const el = this.shadowRoot.querySelector(selector);

        if (el && !el.on) {
            el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
        }

        return el;
    }

    elementAll(selector) {
        const els = this.shadowRoot.querySelectorAll(selector);

        Array.from(els).forEach(el => {
            if (el && !el.on) {
                el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
            }
        });

        return Array.from(els);
    }

    emit(event) {
        return this.shadowRoot.dispatchEvent(event);
    }

    get template() {
        return '<slot></slot>';
    }

    static get injects() {
        return [];
    }

    static get observedAttributes() {
        return [];
    }

    static get styles() {
        return [];
    }
}

module.exports = { CustomElement };
