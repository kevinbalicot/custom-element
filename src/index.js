import { Injectable } from './di';
import { CustomElement } from './custom-element';
import { Router } from './utils';

window.CustomElement = CustomElement;
window.Injectable = Injectable;
window.Router = Router;
