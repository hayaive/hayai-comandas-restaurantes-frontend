import type { FloorPlanTemplate } from "./types";

/**
 * Layout de demostración del editor de plano.
 *
 * Ya NO lo consume `useFloorPlanStore` (que ahora carga salones, plantillas y
 * mesas reales del backend): es la semilla de `src/api/mockClient.ts`, que lo
 * convierte a la forma real del backend —`Mesa` (identidad) + `PlantillaMesa`
 * (sitio en el plano)— para que el modo mock cuente la misma historia sin
 * pedir servidor. El campo `status` de aquí sólo se usa para elegir qué mesas
 * arrancan ocupadas/reservadas en la demo: en el mock, igual que en
 * producción, el estado se DERIVA de las comandas y reservas vivas.
 *
 * Coordenadas en el espacio lógico 1200x700 del canvas (`CANVAS_WIDTH` /
 * `CANVAS_HEIGHT`), medidas al CENTRO de cada mesa.
 */

export const salonPrincipal: FloorPlanTemplate = {
  id: "tpl-salon-principal",
  name: "Salón principal",
  tables: [
    { id: "t1", label: "M-1", shape: "square", x: 140, y: 120, size: 70, seats: 2, status: "occupied", occupantName: "Marisol Peña" },
    { id: "t2", label: "M-2", shape: "square", x: 300, y: 120, size: 70, seats: 2, status: "free" },
    { id: "t3", label: "M-3", shape: "circle", x: 480, y: 130, size: 90, seats: 4, status: "reserved", occupantName: "Familia Restrepo" },
    { id: "t4", label: "M-4", shape: "circle", x: 680, y: 130, size: 90, seats: 4, status: "free" },
    { id: "t5", label: "M-5", shape: "square", x: 880, y: 120, size: 78, seats: 4, status: "occupied", occupantName: "Grupo Herrera" },
    { id: "t6", label: "M-6", shape: "circle", x: 1050, y: 130, size: 90, seats: 4, status: "free" },
    { id: "t7", label: "M-7", shape: "circle", x: 160, y: 340, size: 110, seats: 6, status: "occupied", occupantName: "Mateo Londoño" },
    { id: "t8", label: "M-8", shape: "circle", x: 400, y: 350, size: 110, seats: 6, status: "reserved", occupantName: "Ana Sofía Reyes" },
    { id: "t9", label: "M-9", shape: "square", x: 640, y: 340, size: 96, seats: 6, status: "free" },
    { id: "t10", label: "M-10", shape: "circle", x: 880, y: 350, size: 130, seats: 8, status: "free" },
    { id: "t11", label: "M-11", shape: "square", x: 1090, y: 340, size: 70, seats: 2, status: "occupied", occupantName: "Camila Duarte" },
    { id: "t12", label: "M-12", shape: "square", x: 160, y: 560, size: 70, seats: 2, status: "free" },
    { id: "t13", label: "M-13", shape: "square", x: 320, y: 560, size: 70, seats: 2, status: "free" },
    { id: "t14", label: "M-14", shape: "circle", x: 520, y: 570, size: 90, seats: 4, status: "reserved", occupantName: "Julián Cárdenas" },
    { id: "t15", label: "M-15", shape: "circle", x: 720, y: 570, size: 90, seats: 4, status: "free" },
    { id: "t16", label: "M-16", shape: "square", x: 920, y: 560, size: 78, seats: 4, status: "occupied", occupantName: "Valeria Ocampo" },
  ],
};

export const eventoBoda: FloorPlanTemplate = {
  id: "tpl-evento-boda",
  name: "Evento boda",
  tables: [
    { id: "b1", label: "Novios", shape: "circle", x: 600, y: 110, size: 100, seats: 2, status: "reserved", occupantName: "Mesa de honor" },
    { id: "b2", label: "B-1", shape: "circle", x: 260, y: 260, size: 140, seats: 10, status: "reserved", occupantName: "Familia de la novia" },
    { id: "b3", label: "B-2", shape: "circle", x: 600, y: 300, size: 140, seats: 10, status: "reserved", occupantName: "Padrinos" },
    { id: "b4", label: "B-3", shape: "circle", x: 940, y: 260, size: 140, seats: 10, status: "reserved", occupantName: "Familia del novio" },
    { id: "b5", label: "B-4", shape: "circle", x: 260, y: 500, size: 140, seats: 10, status: "free" },
    { id: "b6", label: "B-5", shape: "circle", x: 600, y: 540, size: 140, seats: 10, status: "free" },
    { id: "b7", label: "B-6", shape: "circle", x: 940, y: 500, size: 140, seats: 10, status: "free" },
  ],
};

export const terraza: FloorPlanTemplate = {
  id: "tpl-terraza",
  name: "Terraza",
  tables: [
    { id: "r1", label: "T-1", shape: "square", x: 200, y: 160, size: 78, seats: 4, status: "free" },
    { id: "r2", label: "T-2", shape: "square", x: 420, y: 160, size: 78, seats: 4, status: "occupied", occupantName: "Santiago Rueda" },
    { id: "r3", label: "T-3", shape: "circle", x: 660, y: 170, size: 90, seats: 4, status: "free" },
    { id: "r4", label: "T-4", shape: "square", x: 900, y: 160, size: 70, seats: 2, status: "reserved", occupantName: "Isabela Nieto" },
    { id: "r5", label: "T-5", shape: "square", x: 260, y: 420, size: 70, seats: 2, status: "free" },
    { id: "r6", label: "T-6", shape: "circle", x: 500, y: 430, size: 110, seats: 6, status: "free" },
    { id: "r7", label: "T-7", shape: "square", x: 780, y: 420, size: 78, seats: 4, status: "occupied", occupantName: "Grupo Salazar" },
  ],
};

export const seedTemplates: FloorPlanTemplate[] = [salonPrincipal, eventoBoda, terraza];
