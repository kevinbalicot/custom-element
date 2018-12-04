/**
Decorators
*/

function component(config) {
    return function decorator(target) {
        if (config.inputs && Array.isArray(config.inputs)) {
            target.observedAttributes = config.inputs;
        }

        if (config.template) {
            target.template = config.template;
        }

        target.style = '';
        if (config.style) {
            target.style = config.style;
        }

        if (!config.selector) {
            throw new Error('Component need selector name.');
        }

        target.prototype.element = null;
        target.prototype.di = di;
        target.prototype.state = {
            set: function(state) {
                if (typeof state != 'object') {
                    throw new Error('State has to be an object.');
                }

                for (var property in state) {
                    this[property] = state[property];
                }
            }
        };

        target.prototype.connectedCallback = function () {
            this.state = new Proxy(this.state, {
                set: (target, property, value) => {
                    target[property] = value;

                    if (null !== this.element) {
                        this.element.dispatchEvent(new CustomEvent('onstatechange', { detail: { scope: [property], state: this.state } }));
                        if (this.onAfterViewChanges) {
                            this.onAfterViewChanges();
                        }
                    }

                    return true;
                }
            });

            if (this.constructor.template && this.constructor.template instanceof HTMLElement) {
                this.innerHTML = String(this.constructor.template.innerHTML);
            } else if (typeof this.constructor.template === 'string') {
                this.innerHTML = this.constructor.template;
            }

            var template = document.createElement('template');
            template.innerHTML = '<style>' + this.constructor.style + '</style><slot></slot>';

            this.attachShadow({ mode: 'open' });
            this.shadowRoot.appendChild(template.content.cloneNode(true));
            this.element = Document.createElement(this.shadowRoot.host, this.shadowRoot.host);

            if (this.onConnected) {
                this.onConnected();
            }

            this.element.dispatchEvent(new CustomEvent('onstatechange', { bubbles: true, detail: { scope: Object.keys(this.state), state: this.state } }));
            //this.element.dispatchEvent(new CustomEvent('onhashchange', { detail: { scope: Object.keys(this.state), state: this.state } }));

            if (this.onAfterViewInit) {
                this.onAfterViewInit();
            }

            var self = this;
            window.addEventListener("hashchange", function() {
                self.element.dispatchEvent(new CustomEvent('onhashchange', { detail: { scope: Object.keys(self.state), state: self.state } }));
            });
        };

        target.prototype.attributeChangedCallback = function(name, oldValue, newValue) {
            this.state[name] = newValue;

            if (this.onChanges) {
                this.onChanges(name, oldValue, newValue);
            }

            if (this.element) {
                this.element.dispatchEvent(new CustomEvent('onstatechange', { detail: { scope: [name], state: this.state } }));
                if (this.onAfterViewChanges) {
                    this.onAfterViewChanges();
                }
            }
        };

        target.prototype.disconnectedCallback = function () {
            if (this.onDisconnected) {
                this.onDisconnected();
            }
        };

        target.prototype.get = function(selector) {
            var element = this.querySelector(selector);

            if (element && !element.on) {
                element.on = function(event, callback, options = false) {
                    element.addEventListener(event, callback, options);
                };
            }

            return element;
        }

        target.prototype.on = function(event, callback, options = false) {
            this.addEventListener(event, callback, options);
        }

        window.customElements.define(config.selector, target);

        return target;
    }
};

function service(config) {
    return function decorator(target) {
        var injects = [];
        if (config.injects) {
            injects = config.injects;
        }

        di.add(target.name, target, injects.map(service => service.name));

        return target;
    }
};

/**
Utils
*/

function parseExpression(expression, state) {
    var f = new Function(...(Object.keys(state).concat([expression])));
    return f(...(Object.values(state)));
};

function applyCustomAttribute(element, attributeNames, value) {
    switch (attributeNames[0]) {
        case 'innerhtml':
            return element.innerHTML = value;
        case 'style':
            return element.style[attributeNames[1]] = value;
        case 'class':
            return value ? element.classList.add(attributeNames[1]) : null;
    }
};

function isDirty(attributeValues, scope) {
    var clean = [];
    attributeValues.forEach(values => {
        clean = clean.concat(values.replace('+', ' ').replace('-', ' ').match(/(\S+)/g));
    });

    return clean.some(c => scope.indexOf(c) !== -1);
};

/**
Classes
*/

function DI() {
    this.items = {};
}

DI.prototype.get = function(key) {
    if (typeof key === 'function') {
        key = key.name;
    } else if (typeof key === 'object') {
        key = key.constructor.name;
    }

    if (!this.items[key]) {
        return null;
    }

    var service = this.items[key];

    if (service.instance) {
        return service.instance;
    }

    this.items[key].instance = new service.object(...service.parameters.map(p => this.get(p)));

    return service.instance;
};

DI.prototype.has = function(key) {
    return !!this.items[key];
};

DI.prototype.add = function(key, value, parameters = []) {
    if (!this.has(key)) {
        this.items[key] = { object: value, parameters };
    }
};

var di = new DI();

class Node {
    constructor(element, parent, children) {
        this.element = element;
        this.parent = parent;
        this.children = children;

        this.customAttributes = [];
        this.customAttributeValues = [];

        for (var i = 0; i < this.element.attributes.length; i++) {
            if (this.element.attributes[i].name.match(/\[(\S)+\]/g)) {
                this.customAttributes.push(this.element.attributes[i]);
                this.customAttributeValues.push(this.element.attributes[i].value);
                this.element.removeAttribute(this.element.attributes[i]);
            }
        }
    }

    handle(scope, state) {
        if (scope && !isDirty(this.customAttributeValues, scope)) {
            return;
        }

        var name;
        this.customAttributes.forEach(attribute => {
            var levels = attribute.name.replace('[', '').replace(']', '').split('.');
            var value = parseExpression('return ' + attribute.value, state);
            applyCustomAttribute(this.element, levels, value);
        });
    }

    dispatchEvent(event) {
        this.children.forEach(node => node.dispatchEvent(event));

        if (-1 != this.attachedEvents.indexOf(event.type)) {
            this.handle(event.detail.scope, event.detail.state);
        }
    }

    get attachedEvents() {
        return ['onhashchange', 'onstatechange'];
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
        var result = parseExpression('return ' + this.if, event.detail.state);

        if (!result && !this.hidden) {
            this.parent.replaceChild(this.mask, this.element);
            this.hidden = true;
        } else if (result && this.hidden) {
            this.parent.replaceChild(this.element, this.mask);
            this.hidden = false;
            super.dispatchEvent(event);
        } else {
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
            var index = els.indexOf(el);
            var state = {};
            var elementClone = self.element.cloneNode(true);
            elementClone.removeAttribute('for');

            self.parent.insertBefore(elementClone, self.mask);

            state[self.for[1]] = els[index];
            state['$index'] = index;

            var node = Document.createElement(elementClone, self.parent);
            node.dispatchEvent(new CustomEvent(event.type, { detail: { state }}));

            self.children.push(node);
        };

        parseExpression(
            'for (' + this.for[0] + ') { iteration(' + this.for[1] + ', ' + this.for[2]+ '); }',
            Object.assign({}, event.detail.state, { iteration })
        );
    }
}

class RouteNode extends IfNode {
    constructor(element, parent, children = []) {
        super(element, parent, children);

        this.if = 'false';
    }

    dispatchEvent(event) {
        this.if = 'window.location.hash.replace("#", "").match(/^' + this.element.getAttribute('route').replace('/', '\\/') + '$/)';
        super.dispatchEvent(event);
    }
}

var Document = {
    createElement: function(element, parent) {
        var children = [];
        for (var i = 0; i < element.children.length; i++) {
            children.push(Document.createElement(element.children[i], element));
        }

        if (element.hasAttribute('for')) {
            return new ForNode(element, parent, children);
        }

        if (element.hasAttribute('if')) {
            return new IfNode(element, parent, children);
        }

        if (element.hasAttribute('route')) {
            return new RouteNode(element, parent, children);
        }

        return new Node(element, parent, children);
    }
}
