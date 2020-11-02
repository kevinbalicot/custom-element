// https://medium.com/@deathmood/how-to-write-your-own-virtual-dom-ee74acc13060
// https://github.com/Swiip/vanilla-modern-js/blob/master/public/vdom/render.js
const VDOM = {
    customAttributes: [],
    addCustomAttribute: function(selector, callback) {
        this.customAttributes.push({ selector, callback });
    },
    createVirtualDOM: createVirtualDOM,
    updateElement: updateElement,
    parseExpression: parseExpression,
};

function flatten(elements) {
    const result = [];

    elements.forEach(element => {
        if (Array.isArray(element)) {
            element.forEach(el => result.push(el));
        } else if (element) {
            result.push(element);
        }
    });

    return result;
}

function changed(node1, node2) {
    return (
        (node1.type !== node2.type) ||
        (node1.type === 'text' && node2.type === 'text' && node1.data !== node2.data)
    );
}

function parseExpression(expression, parameters = {}, scope = {}) {
    parameters = Object.assign({}, parameters);
    if (scope._container) {
        parameters = Object.assign({}, parameters, scope._container.scope);
    }

    const f = new Function(...(Object.keys(parameters).concat([expression])));
    try {
        return f.call(scope, ...(Object.values(parameters)));
    } catch (e) {
        throw new Error(`${e.message} from "${scope.constructor.name} > ${expression}"`);
    }
}

function applyCustomAttribute(element, attribute, scope, details = {}) {
    const attributeNames = attribute.name.split('.');
    let value = parseExpression(`return ${attribute.value}`, Object.assign({}, element.dataset, details), scope);

    switch (attributeNames[0]) {
        case 'style':
            element.style[attributeNames[1]] = !!attributeNames[2] ? value + attributeNames[2] : value;
            break;
        case 'class':
            value ? element.classList.add(attributeNames[1]) : element.classList.remove(attributeNames[1]);
            break;
        case 'classname':
            element.className = value;
            break;
        case 'attribute':
        case 'attr':
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }
            element.setAttribute(attributeNames[1], value);
            break;
        case 'innerhtml':
            element.innerHTML = value;
            break;
        default:
            if (element[attributeNames[0]]) {
                element[attributeNames[0]] = value;
            } else if (!!value) {
                element.setAttribute(attributeNames[0], value);
            } else {
                element.removeAttribute(attributeNames[0]);
            }
    }
}

function applyCustomEvent(element, attribute, scope, details = {}) {
    const attributeNames = attribute.name.split('.');
    element.removeEventListener(attributeNames[0], element[`_${attributeNames[0]}Handler`]);
    element[`_${attributeNames[0]}Handler`] = $event => {
        if (attributeNames[1] === 'prevent') {
            $event.preventDefault();
        }

        if (attributeNames[1] === 'stop') {
            $event.stopPropagation();
        }

        parseExpression(attribute.value, Object.assign({ $event }, element.dataset, details), scope);

        if (attributeNames[1] === 'once') {
            element.removeEventListener(attributeNames[0], element[`_${attributeNames[0]}Handler`]);
        }
    };
    element.addEventListener(attributeNames[0], element[`_${attributeNames[0]}Handler`]);
}

function updateCustomAttributes(element, vElement, scope, details = {}) {
    for (let attribute of vElement.customAttributes) {
        const customAttribute = VDOM.customAttributes.find(({ selector }) => selector === attribute.name);
        if (customAttribute) {
            customAttribute.callback(attribute, element, vElement, scope, details);
        } else {
            applyCustomAttribute(element, attribute, scope, Object.assign({}, details, vElement.scope));
        }
    }
}

function updateCustomEvents(element, vElement, scope, details = {}) {
    for (let attribute of vElement.customEvents) {
        applyCustomEvent(element, attribute, scope, Object.assign({}, details, vElement.scope));
    }
}

function updateElement(parent, newNode, oldNode, scope, details = {}, index = 0) {
    if (!oldNode) {
        if (parent.childNodes[index]) {
            parent.replaceChild(createElement(newNode, scope, details), parent.childNodes[index]);
        } else {
            parent.appendChild(createElement(newNode, scope, details));
        }
    } else if (!newNode) {
        //parent.removeChild(parent.childNodes[index]);
        parent.replaceChild(document.createTextNode(''), parent.childNodes[index]);
    } else if (changed(newNode, oldNode)) {
        parent.replaceChild(createElement(newNode, scope, details), parent.childNodes[index]);
    } else if (newNode.type) {
        if (newNode.type !== 'template' && newNode.type !== 'text') {
            updateCustomEvents(parent.childNodes[index], newNode, scope, details);
            updateCustomAttributes(parent.childNodes[index], newNode, scope, details);
        }

        const newLength = newNode.children.length;
        const oldLength = oldNode.children.length;
        for (let i = 0; i < newLength || i < oldLength; i++) {
            updateElement(
                newNode.type === 'template' ? parent : parent.childNodes[index],
                newNode.children[i],
                oldNode.children[i],
                scope,
                details,
                i
            );
        }
    }
}

function createVirtualDOM(element, scope = {}, details = {}) {
    return {
        type: 'template',
        children: flatten(Array.from(element.childNodes).map(node => createVirtualElement(node, scope, details)))
    };
}

function createVirtualElement(element, scope = {}, details = {}) {
    if (!element) {
        return null;
    }

    if (!element.tagName) {
        return { type: 'text', data: element.data, children: [] };
    }

    const attributesToDelete = [];
    const replaces = [];

    const vElement = {
        customAttributes: [],
        customEvents: [],
        type: String(element.tagName).toLowerCase(),
        _scope: Object.assign({}, details),
        element: null,
        dataset: element.dataset,

        get scope() {
            return this._scope;
        }
    }

    if (element.attributes) {
        for (let i = 0; i < element.attributes.length; i++) {
            if (element.attributes[i].name.match(/\[(\S+)\]/g)) {
                vElement.customAttributes.push({
                    name: element.attributes[i].name.replace('[', '').replace(']', ''),
                    value: element.attributes[i].value,
                });

                attributesToDelete.push(element.attributes[i].name);
            }

            if (element.attributes[i].name.match(/\((\S+)\)/g)) {
                vElement.customEvents.push({
                    name: element.attributes[i].name.replace('(', '').replace(')', ''),
                    value: element.attributes[i].value,
                });

                attributesToDelete.push(element.attributes[i].name);
            }

            for (let customAttribute of VDOM.customAttributes) {
                if (element.attributes[i].name === customAttribute.selector) {
                    vElement.customAttributes.push({
                        name: element.attributes[i].name,
                        value: element.attributes[i].value,
                    });

                    attributesToDelete.push(element.attributes[i].name);
                }
            }

            if (element.attributes[i].name.match(/#if/g)) {
                const ifAttr = element.getAttribute('#if');
                if (!parseExpression('return ' + ifAttr, details, scope)) {
                    return { type: 'text', data: '', children: [] };
                }

                attributesToDelete.push(element.attributes[i].name);
            }

            if (element.attributes[i].name.match(/#for/g)) {
                const forAttr = element.getAttribute('#for').match(/(?:var|let)\s+(\S+)\s+(?:in|of)\s+(\S+)/);

                const iteration = (el, els) => {
                    if (Array.isArray(els)) {
                        details['$index'] = els.indexOf(el);
                    } else {
                        details['$prop'] = els[el];
                    }
                    details[forAttr[1]] = el;

                    const clone = element.cloneNode(true);
                    clone.removeAttribute('#for');

                    replaces.push(createVirtualElement(clone, scope, details));
                };

                parseExpression(
                    'for (' + forAttr[0] + ') { iteration(' + forAttr[1] + ', ' + forAttr[2] + '); }',
                    Object.assign({}, details, { iteration }),
                    scope
                );

                return replaces;
            }
        }
    }

    attributesToDelete.forEach(name => element.removeAttribute(name));

    vElement.attributes = Array.from(element.attributes);
    vElement.children = element.tagName.includes('-') ? [] : flatten(Array.from(element.childNodes).map(node => createVirtualElement(node, scope, details)));

    if (element.tagName.includes('-')) {
        vElement.element = element;
    }

    return vElement;
}

function createElement(vElement, scope, details) {
    if (vElement.type === 'text') {
        return document.createTextNode(vElement.data);
    }

    let element;
    if (vElement.element) {
        element = vElement.element;
    } else {
        element = document.createElement(vElement.type);
    }

    vElement.attributes.forEach(attr => {
        try {
            element.setAttribute(attr.name, attr.value)
        } catch (e) {
            throw Error(`Error occured with attribute "${attr.name}" and value "${attr.value}": ${e.message} `)
        }
    });

    for (let attribute of vElement.customAttributes) {
        updateCustomAttributes(element, vElement, scope, details);
    }

    for (let attribute of vElement.customEvents) {
        updateCustomEvents(element, vElement, scope, details);
    }

    for (let vChild of vElement.children) {
        element.appendChild(createElement(vChild, scope, details));
    }

    return element;
}

module.exports = {
    flatten,
    changed,
    parseExpression,
    applyCustomAttribute,
    applyCustomEvent,
    updateCustomAttributes,
    updateCustomEvents,
    updateElement,
    createVirtualDOM,
    createVirtualElement,
    createElement,
    VDOM,
};
