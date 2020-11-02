import { Injectable } from './di';
import CustomElement from './custom-element';
import { VDOM } from './vdom';

import {
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
    createElement
} from './vdom';

window.CustomElement = CustomElement;
window.Injectable = Injectable;
window.VDOM = VDOM;
window.flatten = flatten;
window.changed = changed;
window.parseExpression = parseExpression;
window.applyCustomAttribute = applyCustomAttribute;
window.applyCustomEvent = applyCustomEvent;
window.updateCustomAttributes = updateCustomAttributes;
window.updateCustomEvents = updateCustomEvents;
window.updateElement = updateElement;
window.createVirtualDOM = createVirtualDOM;
window.createVirtualElement = createVirtualElement;
window.createElement = createElement;
