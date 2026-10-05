# Validación manual de login, teclado y áreas seguras

Ejecutar en un dispositivo Android y, si está disponible, en iPhone. Usar una cuenta de prueba válida y otra que requiera verificación de correo.

En Android, `softwareKeyboardLayoutMode` es configuración nativa de Expo. Para validar ese ajuste hay que instalar una compilación generada después de este cambio; Expo Go puede no reflejarlo.

## Login y teclado

- Abrir el login en orientación vertical y confirmar que el formulario queda centrado cuando el teclado está cerrado.
- Tocar correo y contraseña: el campo enfocado y el botón de acceso deben seguir visibles al abrir el teclado.
- Con el teclado abierto, desplazarse por el formulario; debe poder alcanzarse el botón sin quedar cubierto.
- Tocar «Ingresar» con el teclado visible: el teclado debe permanecer disponible durante el envío y cerrarse al navegar tras el acceso correcto.
- Repetir con credenciales inválidas y con una cuenta sin verificar; el error y el botón de reenvío deben poder verse y utilizarse.
- En Android, comprobar que el teclado no comprime ni cubre permanentemente el formulario. En iOS, comprobar el ajuste vertical sin saltos.

## Barras del sistema y pantallas

- Confirmar que el contenido no queda debajo de la barra de estado, la cámara/notch ni la barra de gestos o navegación.
- Abrir las pestañas y revisar que los botones y el contenido de listas/formularios no quedan detrás de la barra inferior.
- Desplazarse hasta el final de listas y formularios en pantallas compactas; la última acción debe quedar accesible.
- Abrir selectores de catálogos y formularios de venta/compra; comprobar que el teclado y el desplazamiento permiten alcanzar los campos y acciones finales.
- Repetir con navegación gestual y con navegación de tres botones en Android cuando el dispositivo lo permita.

## Resultado

Registrar dispositivo, versión de sistema operativo, tamaño de pantalla y cualquier campo o acción que quede cubierto. Esta verificación requiere un dispositivo físico o emulador y no se sustituye por las pruebas automatizadas.
