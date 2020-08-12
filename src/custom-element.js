const { container } = require('./di');

const TreeNode = require('./nodes/tree-node');

class CustomElement extends HTMLElement {
    constructor() {
        super();

        this._init = false;
        this._container = container;
        this._style = document.createElement('style');
        this._vdom = new TreeNode();

        this.constructor.injects.forEach(inject => {
            this._container.add(inject, inject, inject.injects || []);
        });
    }

    connectedCallback() {
        if (!this._init) {
            const styles = !Array.isArray(this.constructor.styles) ? [this.constructor.styles] : this.constructor.styles;
            this._style.innerHTML = styles.join("\n");

            this.attachShadow({ mode: 'open' });

            this._init = true;
        }

        let html = this.constructor.template;
        if (typeof this.constructor.template === 'string') {
            html = `${this._style.outerHTML}${this.constructor.template}`;
        }

        let details = {};
        if (this.parentNode instanceof ShadowRoot) {
            details = { parent: this.parentNode.host };
        }

        this._vdom.render(this.shadowRoot, html, this, details);

        this.all('slot').forEach(slot => {
            slot.addEventListener('slotchange', () => {
                slot._vdom = new TreeNode();
                for (let node of slot.assignedNodes()) {
                    if (!(node instanceof Text)) {
                        slot._vdom.render(node, node.innerHTML, this, { parent: this.parentNode.host });
                    }
                }
            });
        });

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

        if (this.shadowRoot) {
            let details = {};
            if (this.parentNode instanceof ShadowRoot) {
                details = { parent: this.parentNode.host };
            }

            this._vdom.update(this, details);

            this.all('slot').forEach(slot => {
                for (let node of slot.assignedNodes()) {
                    slot._vdom.update(this, { parent: this.parentNode.host });
                }
            });
        }
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
        console.log('Method element() is deprecated, use el() instead.');
        return this.el(selector);
    }

    el(selector) {
        const el = this.shadowRoot.querySelector(selector);

        if (el && !el.on) {
            el.on = (event, callback, options = false) => el.addEventListener(event, callback, options);
        }

        return el;
    }

    elementAll(selector) {
        console.log('Method elementAll() is deprecated, use all() instead.');
        return this.all(selector);
    }

    all(selector) {
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

    static get template() {
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

module.exports = CustomElement;
