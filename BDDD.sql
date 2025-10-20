-- Tablas
CREATE TABLE sucursales (
  id_sucursal SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  ciudad VARCHAR(50),
  fecha_apertura DATE
);
CREATE TABLE clientes (
  id_cliente SERIAL PRIMARY KEY,
  nombre VARCHAR(150),
  correo VARCHAR(100),
  telefono VARCHAR(20),
  fecha_registro DATE DEFAULT CURRENT_DATE
);
CREATE TABLE productos (
  id_producto SERIAL PRIMARY KEY,
  nombre VARCHAR(150),
  descripcion TEXT,
  precio NUMERIC(10,2),
  stock INTEGER DEFAULT 0
);
CREATE TABLE ventas (
  id_venta SERIAL PRIMARY KEY,
  id_sucursal INTEGER REFERENCES sucursales(id_sucursal),
  id_cliente INTEGER REFERENCES clientes(id_cliente),
  fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total NUMERIC(12,2)
);
CREATE TABLE detalle_venta (
  id_detalle SERIAL PRIMARY KEY,
  id_venta INTEGER REFERENCES ventas(id_venta),
  id_producto INTEGER REFERENCES productos(id_producto),
  cantidad INTEGER,
  precio_unitario NUMERIC(10,2)
);

-- Inserciones
INSERT INTO sucursales (nombre, ciudad, fecha_apertura)
VALUES ('Sucursal Norte', 'Monterrey', '2022-03-15'),
       ('Sucursal Sur', 'Veracruz', '2021-07-01');
INSERT INTO clientes (nombre, correo, telefono)
VALUES ('María Pérez', 'maria@example.com', '2299999000'),
       ('Carlos López', 'carlos@example.com', '2298888000');
INSERT INTO productos (nombre, descripcion, precio, stock)
VALUES ('Cable USB', 'Cable USB-C 1m', 120.00, 50),
       ('Teclado', 'Teclado mecánico', 950.00, 10);
-- Una venta de ejemplo
INSERT INTO ventas (id_sucursal, id_cliente, total)
VALUES (1, 1, 220.00);
INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario)
VALUES (1, 1, 2, 110.00);

-- Ver tablas
SELECT * FROM sucursales;
SELECT v.id_venta, v.fecha_venta, c.nombre AS cliente, s.nombre AS sucursal, v.total
FROM ventas v
JOIN clientes c ON v.id_cliente = c.id_cliente
JOIN sucursales s ON v.id_sucursal = s.id_sucursal;

-- Usuario
CREATE USER usuario WITH PASSWORD '1234';
GRANT CONNECT ON DATABASE empresa_distribuida TO usuario;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO usuario;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE ON TABLES TO usuario;
