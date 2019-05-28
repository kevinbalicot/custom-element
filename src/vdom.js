// https://medium.com/@deathmood/how-to-write-your-own-virtual-dom-ee74acc13060
// https://github.com/Swiip/vanilla-modern-js/blob/master/public/vdom/render.js
const VDOM = {
    customAttributes: [],
    addCustomAttribute: function(selector, callback) {
        this.customAttributes.push({ selector, callback });
    },
    render: render
};

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

function applyCustomAttribute(element, attributeNames, value) {
    for (let customAttribute of VDOM.customAttributes) {
        const { selector, callback } = customAttribute;
        if (attributeNames[0] === selector) {
            return callback(element, value, attributeNames);
        }
    }

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

function applyCustomEvent(element, name, value, scope) {
    element.removeEventListener(name, element[`_${name}Handler`]);
    element[`_${name}Handler`] = $event => parseExpression(value, Object.assign({ $event }, element.dataset), scope);
    element.addEventListener(name, element[`_${name}Handler`]);
}

function updateCustomAttributes(element, newNode, oldNode) {
    const attrNames = new Set();
    newNode.customAttributes.forEach(attr => attrNames.add(attr.name));
    oldNode.customAttributes.forEach(attr => attrNames.add(attr.name));

    for (let attribute of attrNames) {
        const newAttr = newNode.customAttributes.find(attr => attr.name === attribute);
        const oldAttr = oldNode.customAttributes.find(attr => attr.name === attribute);

        if (!oldAttr || !newAttr || newAttr.value !== oldAttr.value) { // NO SURE
            applyCustomAttribute(element, newAttr.name.split('.'), newAttr.value);
        }
    }
}

function changed(node1, node2) {
    return (
        (node1.type !== node2.type) ||
        (node1.type === 'text' && node2.type === 'text' && node1.data !== node2.data)
    );
}

function updateElement(parent, newNode, oldNode, index = 0) {
    if (!oldNode) {
        parent.appendChild(createElement(newNode));
    } else if (!newNode) {
        //parent.removeChild(parent.childNodes[index]);
        parent.replaceChild(document.createTextNode(''), parent.childNodes[index]);
    } else if (changed(newNode, oldNode)) {
        parent.replaceChild(createElement(newNode), parent.childNodes[index]);
    } else if (newNode.type) {
        if (newNode.type !== 'template' && newNode.type !== 'text') {
            updateCustomAttributes(parent.childNodes[index], newNode, oldNode);
        }

        const newLength = newNode.children.length;
        const oldLength = oldNode.children.length;
        for (let i = 0; i < newLength || i < oldLength; i++) {
            updateElement(
                newNode.type === 'template' ? parent : parent.childNodes[index],
                newNode.children[i],
                oldNode.children[i],
                i
            );
        }
    }
}

function parseHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();

    return template.content;
}

function createVirtualDOM(elements, scope = {}) {
    return {
        type: 'template',
        children: Array.from(elements.childNodes).map(node => createVirtualElement(node, scope))
    };
}

function createVirtualElement(element, scope = {}) {
    if (!element) {
        return null;
    }

    if (!element.tagName) {
        return { type: 'text', data: element.data, children: [] };
    }

    const attributesToDelete = [];
    if (!element._customAttributes) {
        element._customAttributes = [];
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                if (element.attributes[i].name.match(/\[(\S+)\]/g)) {
                    element._customAttributes.push({
                        name: element.attributes[i].name.replace('[', '').replace(']', ''),
                        value: parseExpression('return ' + element.attributes[i].value, element.dataset, scope)
                    });
                    attributesToDelete.push(element.attributes[i].name);
                }
            }
        }
    }

    if (!element._customEvents) {
        element._customEvents = [];
        if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
                if (element.attributes[i].name.match(/\((\S+)\)/g)) {
                    element._customEvents.push({
                        name: element.attributes[i].name.replace('(', '').replace(')', ''),
                        value: element.attributes[i].value,
                        scope
                    });
                    attributesToDelete.push(element.attributes[i].name);
                }
            }
        }
    }

    attributesToDelete.forEach(name => element.removeAttribute(name));

    let innerHTMLAttr; // Dirty
    if (innerHTMLAttr = element._customAttributes.find(attr => attr.name === 'innerhtml')) {
        element.innerHTML = innerHTMLAttr.value;
    }

    return {
        type: String(element.tagName).toLowerCase(),
        attributes: Array.from(element.attributes),
        customAttributes: element._customAttributes,
        customEvents: element._customEvents,
        children: Array.from(element.childNodes).map(node => createVirtualElement(node, scope))
    };
}

function createElement(vElement) {
    if (vElement.type === 'text') {
        return document.createTextNode(vElement.data);
    }

    const element = document.createElement(vElement.type);
    vElement.attributes.forEach(attr => element.setAttribute(attr.name, attr.value));
    vElement.customAttributes.forEach(attr => applyCustomAttribute(element, attr.name.split('.'), attr.value));
    vElement.customEvents.forEach(attr => applyCustomEvent(element, attr.name, attr.value, attr.scope));
    vElement.children.forEach(vChild => element.appendChild(createElement(vChild)));

    return element;
}

function render(parent, html, scope = {}) {
    updateElement(
        parent,
        createVirtualDOM(parseHtml(html), scope),
        createVirtualDOM(parent, scope)
    );
}

module.exports = VDOM;
