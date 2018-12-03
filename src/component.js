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

        this._dom = null;

        this.state = new Proxy({
            set: function(state) {
                if (typeof state != 'object') {
                    throw new Error('State has to be an object.');
                }

                for (let property in state) {
                    this[property] = state[property];
                }
            }
        }, {
            set: (target, property, value) => {
                target[property] = value;

                if (null !== this._dom) {
                    this._dom.dispatchEvent(new CustomEvent('onstatechange', { detail: { scope: [property], state: this.state } }));
                    this.onAfterViewChanges();
                }

                return true;
            }
        });

        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this.state[name] = newValue;

        console.log('changes', name, oldValue, newValue);

        this.onChanges(name, oldValue, newValue);

        if (this._dom) {
            this._dom.dispatchEvent(new CustomEvent('onstatechange', { detail: { scope: [name], state: this.state } }));
            this.onAfterViewChanges();
        }
    }

    connectedCallback() {
        console.log('connected');

        this._dom = new VirtualDOM(this.shadowRoot.host, this.shadowRoot.host, this.state);

        this.onConnected();

        this._dom.dispatchEvent(new CustomEvent('onstatechange', { detail: { scope: Object.keys(this.state), state: this.state } }));
        this._dom.dispatchEvent(new CustomEvent('onhashchange', { detail: { scope: Object.keys(this.state), state: this.state } }));

        this.onAfterViewInit();

        window.addEventListener("hashchange", () => {
            this._dom.dispatchEvent(new CustomEvent('onhashchange', { detail: { scope: Object.keys(this.state), state: this.state } }));
        });
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
}
