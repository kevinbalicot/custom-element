function component(value) {
    return function decorator(target) {
        if (value.inputs && Array.isArray(value.inputs)) {
            target.observedAttributes = value.inputs;
        }

        if (value.template) {
            target.template = value.template;
        }

        if (!value.selector) {
            throw new Error('Component need selector name.');
        }

       	window.customElements.define(value.selector, target);

        return target;
    }
}

// https://developers.google.com/web/fundamentals/web-components/examples/howto-tabs
class Component extends HTMLElement {
    constructor() {
        super();

        console.log('constructor');

        if (this.constructor.template && this.constructor.template instanceof HTMLElement) {
            this.innerHTML = String(this.constructor.template.innerHTML);
        } else if (typeof this.constructor.template === 'string') {
            this.innerHTML = this.constructor.template;
        }

        const template = document.createElement('template');
        template.innerHTML = '<style></style><slot></slot>';

        this._state = {};
        this._dom = null;

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this._state[name] = newValue;

        console.log('changes', name, oldValue, newValue);

        this.onChanges(name, oldValue, newValue);

        if (this._dom) {
            dispatch(this._dom, 'DOMStateChange', [name]);
            this.onAfterViewChanges();
        }
    }

    connectedCallback() {
        console.log('connected');

        this._dom = buildDOM(this.shadowRoot.host, this.shadowRoot.host, this._state);

        this.onConnected();

        updateDOM(this._dom);

        this.onAfterViewInit();
    }

    disconnectedCallback() {
        console.log('disconnected');

        this.onDisconnected();
    }

    adoptedCallback() {}

    onChanges() {}

    onConnected() {}

    onDisconnected() {}

    onAfterViewInit() {}

    onAfterViewChanges() {}

    setState(keys, value, updateDOM = true) {
        let scopes = [];
        if (typeof keys === 'object') {
            for (let prop in keys) {
                this.setState(prop, keys[prop], false);
                scopes.push(prop);
            }
        } else {
            this._state[keys] = value;
            scopes.push(keys);
        }

        if (this._dom && updateDOM) {
            dispatch(this._dom, 'DOMStateChange', scopes);
            this.onAfterViewChanges();
        }
    }

    get(selector) {
        const element = this.querySelector(selector);

        if (element) {
            element.on = (event, callback, bool = false) => element.addEventListener(event, callback, bool);
        }

        return element;
    }

    on(event, callback, bool = false) {
        this.addEventListener(event, callback, bool);
    }

    set state(state) {
        if (!this._state) {
            this._state = state;
        }
    }

    get state() {
        return this._state;
    }
}
