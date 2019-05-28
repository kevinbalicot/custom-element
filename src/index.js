import { Injectable } from './di';
import { CustomElement } from './custom-element';
import { Router } from './utils';
import VDOM from './vdom';

window.CustomElement = CustomElement;
window.Injectable = Injectable;
window.Router = Router;
window.VDOM = VDOM;
