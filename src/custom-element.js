const { container } = require('./di');
const { Document } = require('./dom');

class CustomElement extends HTMLElement {
    constructor() {
        super();

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
        try {
            oldValue = JSON.parse(oldValue);
        } catch (e) {}

        try {
            newValue = JSON.parse(newValue);
        } catch (e) {}

        if (oldValue === newValue) {
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

    update(element = null, details = {}) {
        if (null === this.elementRef) {
            return false;
        }

        if (Array.isArray(element)) {
            return element.map(el => this.update(el, details));
        }

        if (typeof element === 'string') {
            element = this.element(element);
        }

        for (let prop in details) {
            if (undefined !== this[prop]) {
                this[prop] = details[prop];
            }
        }

        if (null !== element) {
            Document.searchNode(element, this.elementRef).update(Object.assign({}, this._container.scope), this);
        } else {
            this.elementRef.update(Object.assign({}, this._container.scope), this);
        }

        Document.cleanNode(this.elementRef);

        return true;
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
        this.elementRef.element.addEventListener(event, callback, options);

        return this;
    }

    element(selector) {
        const el = this.elementRef.element.querySelector(selector);

        if (el && !el.on) {
            el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
        }

        return el;
    }

    elementAll(selector) {
        const els = this.elementRef.element.querySelectorAll(selector);

        Array.from(els).forEach(el => {
            if (el && !el.on) {
                el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
            }
        });

        return Array.from(els);
    }

    emit(event) {
        return this.elementRef.element.host.dispatchEvent(event);
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

module.exports = { CustomElement };
