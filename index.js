
// ======================================================
// 1. REFERENCIAS AL HTML
// ======================================================

const escrito = document.getElementById("observacion");
const enlaceVideo = document.getElementById("videoLink");
const imagenes = document.getElementById("imagen");
const previo = document.getElementById("vistaPrevia");
const mensaje = document.getElementById("mensaje");
const btnGuardar = document.getElementById("btnGuardar");

// Login
const seccionLogin = document.getElementById("seccionLogin");
const seccionApp = document.getElementById("seccionApp");
const loginCorreo = document.getElementById("loginCorreo");
const loginClave = document.getElementById("loginClave");
const btnLogin = document.getElementById("btnLogin");
const btnSalir = document.getElementById("btnSalir");
const usuarioActual = document.getElementById("usuarioActual");


// ======================================================
// 2. CONFIGURACIÓN DE SUPABASE
// ======================================================

const SUPABASE_URL = "https://wzjvwinguxledbkbuvmq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sTu5pVkfVgtJ-M11kPDPcA_djy40zW1";

const clienteSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const NOMBRE_BUCKET = "tus-imagenes"; // donde van las fotos
const NOMBRE_TABLA = "entradas";      // donde van texto, fecha, foto y video


// ======================================================
// 3. COMPRIMIR IMAGEN (igual que antes)
// ======================================================

function comprimirImagen(archivo, anchoMaximo = 1200, calidad = 0.7) {
    return new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = function (evento) {

            const img = new Image();

            img.onload = function () {

                let ancho = img.width;
                let alto = img.height;

                if (ancho > anchoMaximo) {
                    alto = Math.round((alto * anchoMaximo) / ancho);
                    ancho = anchoMaximo;
                }

                const canvas = document.createElement("canvas");
                canvas.width = ancho;
                canvas.height = alto;

                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    reject(new Error("No se pudo crear el Canvas"));
                    return;
                }

                ctx.drawImage(img, 0, 0, ancho, alto);

                canvas.toBlob(function (blob) {

                    if (!blob) {
                        reject(new Error("No se pudo comprimir la imagen"));
                        return;
                    }

                    resolve(
                        new File([blob], "imagen.jpg", {
                            type: "image/jpeg",
                            lastModified: Date.now()
                        })
                    );
                }, "image/jpeg", calidad);
            };

            img.onerror = () => reject(new Error("No se pudo leer la imagen"));
            img.src = evento.target.result;
        };

        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(archivo);
    });
}


// ======================================================
// 4. MOSTRAR MENSAJE (aviso flotante)
// ======================================================

let temporizadorMensaje = null;

function mostrarMensaje(texto, tipo = "normal") {

    mensaje.textContent = texto;

    // El color lo decide el CSS según la clase: #mensaje.error / #mensaje.exito
    mensaje.className = tipo === "normal" ? "" : tipo;

    // Cancela el temporizador anterior, si había uno
    clearTimeout(temporizadorMensaje);

    // Los avisos de éxito o error desaparecen solos a los 7 segundos
    if (tipo !== "normal") {

        temporizadorMensaje = setTimeout(function () {
            mensaje.textContent = "";
            mensaje.className = "";
        }, 7000);
    }
}


// ======================================================
// 5. FUNCIONES AUXILIARES
// ======================================================

// Crea un elemento con su clase y su texto, en una sola línea
function crearElemento(etiqueta, clase, texto) {

    const elemento = document.createElement(etiqueta);

    if (clase) elemento.className = clase;
    if (texto) elemento.textContent = texto;

    return elemento;
}


// Fecha completa: día de la semana, fecha, hora, minuto y segundo
function formatearFecha(textoFecha) {

    const texto = new Date(textoFecha).toLocaleString("es-CO", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/Bogota"
    });

    // Primera letra en mayúscula: "Martes, 17 de noviembre..."
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}


// Saca el ID de un enlace de YouTube. Devuelve null si no es válido.
// Acepta: youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID
function obtenerIdYoutube(enlace) {

    try {

        const url = new URL(enlace.trim());
        const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

        let id = null;

        if (host === "youtu.be") {

            id = url.pathname.slice(1).split("/")[0];

        } else if (host === "youtube.com" || host === "music.youtube.com") {

            if (url.pathname === "/watch") {
                id = url.searchParams.get("v");
            } else {
                const partes = url.pathname.split("/");
                if (["shorts", "embed", "live"].includes(partes[1])) {
                    id = partes[2];
                }
            }
        }

        // Los IDs de YouTube tienen 11 caracteres: letras, números, - y _
        if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
            return id;
        }

        return null;

    } catch (e) {
        return null; // el texto ni siquiera era una URL
    }
}


// Crea un botón de eliminar. Su aspecto está en el CSS (.btn-eliminar)
function crearBotonEliminar(texto, alHacerClic, claseExtra) {

    const boton = crearElemento("button", "btn-eliminar", texto);

    boton.type = "button";

    if (claseExtra) boton.classList.add(claseExtra);

    boton.addEventListener("click", alHacerClic);

    return boton;
}


// ======================================================
// 6. DIBUJAR LAS ENTRADAS
// JS solo crea los elementos y les pone clase.
// Todo el diseño está en index.css.
// ======================================================

function renderizarEntradas(entradas) {

    previo.innerHTML = "";

    // Sin entradas: mensaje amable y sin línea de tiempo
    previo.classList.toggle("vacia", entradas.length === 0);

    if (entradas.length === 0) {

        previo.appendChild(
            crearElemento(
                "li",
                "vacio",
                "Aún no hay entradas. Escribe la primera arriba."
            )
        );

        return;
    }

    entradas.forEach(function (entrada) {

        const li = crearElemento("li", "entrada");
        const tarjeta = crearElemento("div", "entrada-tarjeta");

        // --- Fecha ---
        const fecha = crearElemento(
            "time",
            "entrada-fecha",
            formatearFecha(entrada.created_at)
        );
        fecha.dateTime = entrada.created_at;

        tarjeta.appendChild(fecha);

        // --- Cuerpo: imagen, video y texto ---
        const cuerpo = crearElemento("div", "entrada-cuerpo");

        // Imagen
        if (entrada.imagen_url) {

            const img = crearElemento("img", "entrada-imagen");

            img.src = entrada.imagen_url;
            img.alt = entrada.observacion || "Imagen de la bitácora";
            img.loading = "lazy";

            img.onerror = function () {
                console.error("No se pudo mostrar la imagen:", entrada.imagen_url);
                img.alt = "No se pudo cargar la imagen";
            };

            cuerpo.appendChild(img);
        }

        // Video de YouTube embebido
        if (entrada.video_url) {

            const idVideo = obtenerIdYoutube(entrada.video_url);

            if (idVideo) {

                const contenedorVideo = crearElemento("div", "entrada-video");
                const iframe = document.createElement("iframe");

                iframe.src = "https://www.youtube.com/embed/" + idVideo;
                iframe.title = "Video de YouTube";
                iframe.allow =
                    "accelerometer; autoplay; clipboard-write; " +
                    "encrypted-media; gyroscope; picture-in-picture";
                iframe.allowFullscreen = true;
                iframe.loading = "lazy";

                contenedorVideo.appendChild(iframe);
                cuerpo.appendChild(contenedorVideo);
            }
        }

        // Descripción
        if (entrada.observacion) {

            cuerpo.appendChild(
                crearElemento("p", "entrada-texto", entrada.observacion)
            );
        }

        tarjeta.appendChild(cuerpo);

        // --- Botones de eliminar ---
        const acciones = crearElemento("div", "entrada-acciones");

        let partes = 0;

        if (entrada.observacion) {
            partes++;
            acciones.appendChild(
                crearBotonEliminar("Eliminar descripción", () =>
                    eliminarParte(entrada, "observacion")
                )
            );
        }

        if (entrada.imagen_url) {
            partes++;
            acciones.appendChild(
                crearBotonEliminar("Eliminar imagen", () =>
                    eliminarParte(entrada, "imagen")
                )
            );
        }

        if (entrada.video_url) {
            partes++;
            acciones.appendChild(
                crearBotonEliminar("Eliminar video", () =>
                    eliminarParte(entrada, "video")
                )
            );
        }

        // Si hay más de una parte, también se puede borrar todo junto
        if (partes > 1) {
            acciones.appendChild(
                crearBotonEliminar(
                    "Eliminar entrada completa",
                    () => eliminarEntrada(entrada),
                    "btn-eliminar--todo"
                )
            );
        }

        tarjeta.appendChild(acciones);

        li.appendChild(tarjeta);
        previo.appendChild(li);
    });
}


// ======================================================
// 7. CARGAR ENTRADAS DESDE LA BASE DE DATOS
// ======================================================

async function cargarEntradas() {

    const { data, error } = await clienteSupabase
        .from(NOMBRE_TABLA)
        .select("*")
        .order("created_at", { ascending: false }) // la más reciente primero
        .limit(100);

    if (error) {
        console.error("Error al cargar entradas:", error);
        mostrarMensaje("No se pudieron cargar las entradas: " + error.message, "error");
        return;
    }

    renderizarEntradas(data);
}


// ======================================================
// 8. GUARDAR UNA ENTRADA (botón)
// ======================================================

async function guardarEntrada() {

    const texto = escrito.value.trim();
    const enlace = enlaceVideo.value.trim();
    const archivo = imagenes.files[0];

    // Debe haber al menos una de las tres cosas
    if (!texto && !enlace && !archivo) {
        mostrarMensaje(
            "Escribe una descripción, pega un enlace de YouTube o elige una imagen.",
            "error"
        );
        return;
    }

    // Validar el enlace de YouTube, si lo hay
    if (enlace && !obtenerIdYoutube(enlace)) {
        mostrarMensaje("Ese enlace no parece ser un video de YouTube.", "error");
        return;
    }

    // Validar la imagen, si la hay
    if (archivo) {

        if (!archivo.type.startsWith("image/")) {
            mostrarMensaje("El archivo seleccionado no es una imagen.", "error");
            imagenes.value = "";
            return;
        }

        if (archivo.size > 10 * 1024 * 1024) {
            mostrarMensaje("La imagen no puede superar los 10 MB.", "error");
            imagenes.value = "";
            return;
        }
    }

    btnGuardar.disabled = true; // evita doble clic

    try {

        let urlImagen = null;

        // --- Paso 1: subir la imagen (si hay) ---
        if (archivo) {

            mostrarMensaje("Comprimiendo imagen...");
            const comprimido = await comprimirImagen(archivo);

            const nombreArchivo = `${Date.now()}_${crypto.randomUUID()}.jpg`;

            mostrarMensaje("Subiendo imagen...");

            const { error: errorSubida } = await clienteSupabase
                .storage
                .from(NOMBRE_BUCKET)
                .upload(nombreArchivo, comprimido, {
                    contentType: "image/jpeg",
                    cacheControl: "3600",
                    upsert: false
                });

            if (errorSubida) throw errorSubida;

            urlImagen = clienteSupabase
                .storage
                .from(NOMBRE_BUCKET)
                .getPublicUrl(nombreArchivo)
                .data.publicUrl;
        }

        // --- Paso 2: guardar todo en la tabla ---
        mostrarMensaje("Guardando entrada...");

        const { error: errorTabla } = await clienteSupabase
            .from(NOMBRE_TABLA)
            .insert({
                observacion: texto || null,
                imagen_url: urlImagen,
                video_url: enlace || null
            });
            // created_at lo pone Supabase solo, con la fecha y hora exactas

        if (errorTabla) throw errorTabla;

        // --- Paso 3: limpiar y refrescar ---
        escrito.value = "";
        enlaceVideo.value = "";
        imagenes.value = "";

        await cargarEntradas();

        mostrarMensaje("Entrada guardada correctamente.", "exito");

    } catch (error) {

        console.error("ERROR AL GUARDAR:", error);
        mostrarMensaje("Ocurrió un error: " + error.message, "error");

    } finally {
        btnGuardar.disabled = false; // se ejecuta siempre, haya error o no
    }
}

btnGuardar.addEventListener("click", guardarEntrada);


// ======================================================
// 9. ELIMINAR (descripción, imagen, video o todo)
// ======================================================

// Borra una fila de la tabla. Si Supabase no la borra, avisa.
async function borrarFila(id) {

    const { data, error } = await clienteSupabase
        .from(NOMBRE_TABLA)
        .delete()
        .eq("id", id)
        .select();

    if (error) throw error;

    // Sin política de DELETE, Supabase no da error: simplemente no borra nada
    if (!data || data.length === 0) {
        throw new Error(
            "Supabase no permitió borrar la entrada. Revisa las políticas de la tabla."
        );
    }
}


// Cambia campos de una fila (por ejemplo, poner video_url en null)
async function actualizarFila(id, cambios) {

    const { data, error } = await clienteSupabase
        .from(NOMBRE_TABLA)
        .update(cambios)
        .eq("id", id)
        .select();

    if (error) throw error;

    if (!data || data.length === 0) {
        throw new Error(
            "Supabase no permitió modificar la entrada. Revisa las políticas de la tabla."
        );
    }
}


// Borra la foto del bucket. Devuelve true si se borró.
async function borrarImagenDelBucket(urlImagen) {

    // La URL termina en el nombre del archivo
    const nombreArchivo = decodeURIComponent(
        urlImagen.split("/").pop().split("?")[0]
    );

    const { data, error } = await clienteSupabase
        .storage
        .from(NOMBRE_BUCKET)
        .remove([nombreArchivo]);

    if (error) {
        console.error("Error al borrar la imagen del bucket:", error);
        return false;
    }

    // Sin política de DELETE en storage, data llega vacío
    return Boolean(data && data.length > 0);
}


async function eliminarParte(entrada, parte) {

    const nombres = {
        observacion: "la descripción",
        imagen: "la imagen",
        video: "el video"
    };

    if (!confirm(`¿Eliminar ${nombres[parte]} de esta entrada?`)) {
        return;
    }

    try {

        // ¿Qué quedaría en la entrada después de borrar esta parte?
        const quedaria = {
            observacion: parte === "observacion" ? null : entrada.observacion,
            imagen_url: parte === "imagen" ? null : entrada.imagen_url,
            video_url: parte === "video" ? null : entrada.video_url
        };

        const quedaAlgo =
            quedaria.observacion || quedaria.imagen_url || quedaria.video_url;

        // Primero la base de datos
        if (quedaAlgo) {
            await actualizarFila(entrada.id, {
                observacion: quedaria.observacion,
                imagen_url: quedaria.imagen_url,
                video_url: quedaria.video_url
            });
        } else {
            // Era lo último que tenía: se borra la entrada entera
            await borrarFila(entrada.id);
        }

        // Después el archivo del bucket (solo si era la imagen)
        let imagenBorrada = true;

        if (parte === "imagen") {
            imagenBorrada = await borrarImagenDelBucket(entrada.imagen_url);
        }

        await cargarEntradas();

        if (imagenBorrada) {
            mostrarMensaje("Eliminado correctamente.", "exito");
        } else {
            mostrarMensaje(
                "Se quitó de la entrada, pero el archivo sigue en el bucket (falta la política de borrado de Storage).",
                "error"
            );
        }

    } catch (error) {

        console.error("ERROR AL ELIMINAR:", error);
        mostrarMensaje("No se pudo eliminar: " + error.message, "error");
    }
}


async function eliminarEntrada(entrada) {

    if (!confirm("¿Eliminar esta entrada completa (descripción, imagen y video)?")) {
        return;
    }

    try {

        await borrarFila(entrada.id);

        let imagenBorrada = true;

        if (entrada.imagen_url) {
            imagenBorrada = await borrarImagenDelBucket(entrada.imagen_url);
        }

        await cargarEntradas();

        if (imagenBorrada) {
            mostrarMensaje("Entrada eliminada.", "exito");
        } else {
            mostrarMensaje(
                "Se eliminó la entrada, pero la imagen sigue en el bucket (falta la política de borrado de Storage).",
                "error"
            );
        }

    } catch (error) {

        console.error("ERROR AL ELIMINAR:", error);
        mostrarMensaje("No se pudo eliminar: " + error.message, "error");
    }
}


// ======================================================
// 10. LOGIN: iniciar y cerrar sesión
// ======================================================

// Muestra la bitácora y esconde el login
function mostrarApp(sesion) {

    usuarioActual.textContent = "Sesión: " + sesion.user.email;

    seccionLogin.hidden = true;   // esconde el login
    seccionApp.hidden = false;    // muestra la bitácora

    cargarEntradas();             // ahora sí, trae las entradas
}


// Muestra el login y esconde la bitácora
function mostrarLogin() {

    seccionApp.hidden = true;
    seccionLogin.hidden = false;

    previo.innerHTML = "";        // no deja entradas en pantalla
    loginClave.value = "";        // borra la contraseña escrita
}


// Se ejecuta al hacer clic en "Entrar"
async function iniciarSesion() {

    const correo = loginCorreo.value.trim();
    const clave = loginClave.value;

    if (!correo || !clave) {
        mostrarMensaje("Escribe tu correo y tu contraseña.", "error");
        return;
    }

    btnLogin.disabled = true; // evita doble clic

    try {

        // Aquí se habla con Supabase: le mandamos correo y contraseña
        const { data, error } = await clienteSupabase
            .auth
            .signInWithPassword({
                email: correo,
                password: clave
            });

        if (error) {

            console.error("ERROR DE LOGIN:", error);

            if (error.message.includes("Invalid login credentials")) {
                mostrarMensaje("Correo o contraseña incorrectos.", "error");
            } else {
                mostrarMensaje("No se pudo iniciar sesión: " + error.message, "error");
            }

            return;
        }

        // Si llegó aquí, Supabase aceptó los datos y devolvió una sesión
        mostrarApp(data.session);

    } catch (error) {

        console.error("ERROR GENERAL DE LOGIN:", error);
        mostrarMensaje("Ocurrió un error: " + error.message, "error");

    } finally {
        btnLogin.disabled = false;
    }
}


// Se ejecuta al hacer clic en "Cerrar sesión"
async function cerrarSesion() {

    const { error } = await clienteSupabase.auth.signOut();

    if (error) {
        console.error("ERROR AL CERRAR SESIÓN:", error);
        mostrarMensaje("No se pudo cerrar la sesión: " + error.message, "error");
        return;
    }

    mostrarLogin();
}


btnLogin.addEventListener("click", iniciarSesion);
btnSalir.addEventListener("click", cerrarSesion);

// Presionar Enter en el correo o en la contraseña también entra
[loginCorreo, loginClave].forEach(function (campo) {
    campo.addEventListener("keydown", function (e) {
        if (e.key === "Enter") iniciarSesion();
    });
});


// Si la sesión se cierra por otro lado (otra pestaña, o venció),
// volvemos al login. Aquí no se llama a Supabase, solo se cambia la pantalla.
clienteSupabase.auth.onAuthStateChange(function (evento) {
    if (evento === "SIGNED_OUT") {
        mostrarLogin();
    }
});


// ======================================================
// 10.1 INICIAR: ¿ya hay una sesión guardada?
// Supabase guarda la sesión en el navegador, así que al
// recargar la página no hay que volver a escribir la clave.
// ======================================================

async function revisarSesion() {

    const { data } = await clienteSupabase.auth.getSession();

    if (data.session) {
        mostrarApp(data.session);
    } else {
        mostrarLogin();
    }
}

revisarSesion();


// ======================================================
// 11. MAXIMIZAR IMAGEN
// ======================================================

const modal = document.getElementById("modalImagen");
const imgMax = document.getElementById("imagenMaximizada");
const btnCerrar = document.getElementById("btnCerrarModal");

// Abrir: clic en cualquier imagen de una entrada
previo.addEventListener("click", function (e) {
    if (e.target.classList.contains("entrada-imagen")) {
        imgMax.src = e.target.src;
        modal.classList.add("activo");
    }
});

// Cerrar: botón ×, clic fuera de la foto, o tecla Escape
btnCerrar.addEventListener("click", () => modal.classList.remove("activo"));

modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("activo");
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.classList.remove("activo");
});