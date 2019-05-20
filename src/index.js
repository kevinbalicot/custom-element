import { Injectable } from './di';
import { CustomElement } from './custom-element';
import { Router } from './utils';
import { Document, CustomNode } from './dom';

window.CustomElement = CustomElement;
window.Injectable = Injectable;
window.Router = Router;
window.Document = Document;
window.CustomNode = CustomNode;
