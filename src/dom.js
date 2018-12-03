const EVALUATE_PATTERN = /\{\{([\s\S]+?)\}\}/;

class TextNode {
    constructor(element, parent) {
        this.element = element;
        this.template = String(element.data);
        this.bindings = {};

        const regexp = new RegExp(EVALUATE_PATTERN, 'g');
        const matches = this.template.match(regexp);

        (matches || []).forEach(match => {
            const [ complet, property ] = new RegExp(EVALUATE_PATTERN).exec(match);
            this.bindings[property.trim()] = complet;
        });
    }

    data(state) {
        let template = String(this.template);
        for (let property in this.bindings) {
            if (state && undefined !== state[property.trim()]) {
                template = template.replace(this.bindings[property], state[property.trim()]);
            } else {
                throw new Error(`Variable ${property.trim()} not found in "${this.bindings[property]}".`);
            }
        }

        return template;
    }
}

class Node {
    constructor(element, parent, children = []) {
        this.element = element;
        this.textNodes = [];
        this.parent = parent;
        this.children = children;

        for (let i = 0; i < this.element.childNodes.length; i++) {
            if (this.element.childNodes[i] instanceof Text) {
                this.textNodes.push(new TextNode(this.element.childNodes[i], this.element));
            }
        }

        this.bindings = [].concat(...this.textNodes.map(node => Object.keys(node.bindings)));
    }

    update(freshState) {
        this.textNodes.forEach(textNode => textNode.element.data = textNode.data(freshState));
    }

    dispatchEvent(event) {
        if (this.bindings.some(b => event.detail.scope.indexOf(b) !== -1)) {
            this.update(event.detail.state);
        }
    }

    get events() {
        return ['onstatechange'];
    }
}

class IfNode extends Node {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = this.element.getAttribute('if');
        this.mask = document.createTextNode('');
        this.hidden = false;
    }

    update(freshState) {
        const f = new Function(...(Object.keys(freshState).concat([`return ${this.if}`])));
        const result = f(...(Object.values(freshState)));
        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.update(freshState);
        } else {
            super.update(freshState);
        }
    }

    dispatchEvent(event) {
        this.update(event.detail.state);
    }
}

class ForNode {
    constructor(element, parent) {
        this.element = element;
        this.parent = parent;

        this.for = this.element.getAttribute('for').match(/(?:var|let)\s+(\S+)\s+(?:in|of)\s+(\S+)/);
        this.mask = document.createTextNode('');
        this.children = [];

        this.parent.replaceChild(this.mask, this.element);
    }

    update(freshState) {
        this.children.forEach(child => {
            if (Array.from(this.parent.children).indexOf(child.element) !== -1) {
                this.parent.removeChild(child.element);
            }
        });
        this.children = [];

        const iteration = (element, elements) => {
            const index = elements.indexOf(element);
            const state = {};
            const elementClone = this.element.cloneNode(true);
            elementClone.removeAttribute('for');

            this.mask.before(elementClone);

            state[this.for[1]] = elements[index];

            const dom = new VirtualDOM(elementClone, this.parent);
            dom.update(Object.assign(state, freshState));

            this.children.push(dom);
        };

        const f = new Function(...Object.keys(freshState).concat(['iteration', `for (${this.for[0]}) { iteration(${this.for[1]}, ${this.for[2]}); }`]));
        f(...Object.values(freshState).concat([iteration]));
    }

    dispatchEvent(event) {
        this.update(event.detail.state);
    }

    get events() {
        return ['onstatechange'];
    }
}

class RouteNode extends IfNode {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = 'false';
    }

    update(freshState) {
        this.if = `window.location.hash.replace('#', '').match(/${this.element.getAttribute('route').replace('/', '\\/')}/)`;
        super.update(freshState);
    }

    dispatchEvent(event) {
        this.update(event.detail.state);
    }

    get events() {
        return ['onhashchange'];
    }
}

class VirtualDOM {
    constructor(element, parent, state = {}) {
        this.listeners = [];
        this.state = {};
        this.root = this.create(element, parent);
    }

    create(element, parent) {
        let node = null;
        if (element !== parent && element instanceof Component) {
            return { children: [], update: () => {} };
        }

        const children = [];
        for (let i = 0; i < element.children.length; i++) {
            children.push(this.create(element.children[i], element));
        }

        if (element.hasAttribute('for')) {
            node = new ForNode(element, parent);
        }

        if (element.hasAttribute('if')) {
            node = new IfNode(element, parent, children);
        }

        if (element.hasAttribute('route')) {
            node = new RouteNode(element, parent, children);
        }

        if (null === node) {
            node = new Node(element, parent, children);
        }

        node.events.forEach(eventName => this.addEventListener(eventName, event => node.dispatchEvent(event)));

        return node;
    }

    addEventListener(eventName, callback) {
        this.listeners.push({ eventName, callback });
    }

    dispatchEvent(event) {
        this.listeners.filter(listener => listener.eventName === event.type)
            .forEach(listener => listener.callback(event));
    }
}
