/* README

    CUANDO LO USES, TENES QUE PROBAR SI TE BAJA CORRECTAMENTE EL COMPROBANTE

    - Correr: node facturador.ts
    - Ingresar credenciales manualmente.
    - Ir a "Comprobantes en Linea"
    - Cerrar la pestaña anterior
    - Seleccionar mi nombre
    - Volver a la terminal. Tipear 1 y ENTER
    - Ingresar '1de1' para hacer un chequeo
    - Esperar a la magia
    - Corroborar que salio todo bien. Renombrate el archivo anterior.
    - Volver a ejecutar automatizacion... pero ahora podes poder '2de17' por ej.
    - Al finalizar volver a la terminal. Tipear 2 y ENTER

*/

const { Builder, By } = require('selenium-webdriver');
const readline = require('readline');
const chrome = require('selenium-webdriver/chrome');
const { Select } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

require('chromedriver');

(async function facturador() {
  const options = new chrome.Options();
 
  options.setUserPreferences({
    "download.prompt_for_download": false,
    "download.default_directory": '/Users/rodrigombh/Documents/Facturas Emitidas',
    "profile.default_content_settings.popups": 0
  });

  const driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  const now = new Date();
  const primerDiaMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const ultimoDiaMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);
  const fechaDesde = primerDiaMesAnterior.toLocaleDateString('es-AR');
  const fechaHasta = ultimoDiaMesAnterior.toLocaleDateString('es-AR');
  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const mesAño = `${meses[primerDiaMesAnterior.getMonth()]}${primerDiaMesAnterior.getFullYear()}`;
  const downloadDir = '/Users/rodrigombh/Documents/Facturas Emitidas';

  try {
    await driver.get('https://auth.afip.gob.ar/contribuyente_/login.xhtml');

    while (true) {
      console.log("\nOpciones:");
      console.log("1. Ejecutar automatización");
      console.log("2. Cerrar el navegador y salir");

      const choice = await getUserInput("Selecciona una opción (1/2): ");

      if (choice === "1") {
        const facturaFormato = await getUserInput("Ingrese el formato contador de factura (ej: 5de16): ");
        const { inicio, final } = parseFacturaFormato(facturaFormato);

        const handles = await driver.getAllWindowHandles();
        if (handles.length > 1) {
          await driver.switchTo().window(handles[handles.length - 1]);
        } else {
          await driver.switchTo().window(handles[0]);
        }

        console.log("Ejecutando automatización...");
 
        for (var i = inicio; i <= final; i++) {
          try {
            // RCEL - RÉGIMEN DE COMPROBANTES EN LÍNEA
            const botonGenerar = await driver.findElement(By.xpath("//*[text()='Generar Comprobantes']"));
            await botonGenerar.click();
            await sleep(1000);
       
            // Puntos de Ventas y Tipos de Comprobantes habilitados para impresión
            const selectPuntoDeVenta = new Select(await driver.findElement(By.id("puntodeventa")));
            await selectPuntoDeVenta.selectByValue("1");
            await sleep(1000);
            let botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Continuar >']"));
            await botonContinuar.click();
            await sleep(1000);
       
            // DATOS DE EMISIÓN (PASO 1 DE 4)
            const selectConcepto = new Select(await driver.findElement(By.id("idconcepto")));
            await selectConcepto.selectByValue("2");
       
            await driver.findElement(By.id("fsd")).clear();
            await driver.findElement(By.id("fsd")).sendKeys(fechaDesde);
           
            await driver.findElement(By.id("fsh")).clear();
            await driver.findElement(By.id("fsh")).sendKeys(fechaHasta);
       
            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Continuar >']"));
            await botonContinuar.click();
            await sleep(1000);
       
            // DATOS DEL RECEPTOR (PASO 2 DE 4)
            const selectIvaReceptor = new Select(await driver.findElement(By.id("idivareceptor")));
            await selectIvaReceptor.selectByValue("5");
       
            const checkboxContado = await driver.findElement(By.id("formadepago1"));
            await checkboxContado.click();
           
            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Continuar >']"));
            await botonContinuar.click();
            await sleep(1000);
       
            // DATOS DE LA OPERACIÓN (PASO 3 DE 4)
            await driver.findElement(By.name("detalleCodigoArticulo")).sendKeys("1");
            await driver.findElement(By.id("detalle_descripcion1")).sendKeys("Honorarios");
           
            const selectUMedida = new Select(await driver.findElement(By.id("detalle_medida1")));
            await selectUMedida.selectByValue("98");
       
            await driver.findElement(By.id("detalle_precio1")).sendKeys("172200");
       
            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Continuar >']"));
            await botonContinuar.click();
            await sleep(500);

            // RESUMEN DE DATOS (PASO 4 DE 4)
            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Confirmar Datos...']"));
            await botonContinuar.click();

            await driver.wait(async () => {
              try {
                let alert = await driver.switchTo().alert();
                await alert.accept();
                return true;
              } catch (e) {
                return false;
              }
            }, 5000);
            await sleep(1000);

            const archivosAntes = new Set(fs.readdirSync(downloadDir).filter(file => file.endsWith('.pdf')));
            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Imprimir...']"));
            await botonContinuar.click();
            let pdfFile;
            let downloadTimeout = 20000;
            const startTime = Date.now();
            while (Date.now() - startTime < downloadTimeout) {
              const archivosDespues = fs.readdirSync(downloadDir).filter(file => file.endsWith('.pdf'));
              const nuevoArchivo = archivosDespues.find(file => !archivosAntes.has(file));
              if (nuevoArchivo) {
                pdfFile = path.join(downloadDir, nuevoArchivo);
                break;
              }
              await sleep(1000);
            }
            if (!pdfFile) {
              throw "⛔ No se encontró el archivo PDF después de esperar.";
            }
            const oldPath = pdfFile;
            const nuevoNombre = `factura-${i}de${final}-${mesAño}.pdf`;
            const newPath = path.join(downloadDir, nuevoNombre);
            fs.renameSync(oldPath, newPath);
            await sleep(1000);

            botonContinuar = await driver.findElement(By.xpath("//input[@type='button' and @value='Menú Principal']"));            
            await botonContinuar.click();
            await sleep(1000);

            console.log("Automatización completada.");
          } catch (error) {
            console.error("Error durante la automatización:", error.message);
          }
        }
       
      } else if (choice === "2") {
        console.log("Cerrando el navegador...");
        await driver.quit();
        console.log("Navegador cerrado. Hasta luego.");
        break;
      } else {
        console.log("Opción no válida. Intenta de nuevo.");
      }
    }
  } catch (error) {
    console.error("Error general:", error.message);
  }
})();

function getUserInput(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(promptText, (ans) => {
            rl.close();
            resolve(ans.trim());
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseFacturaFormato(input) {
  const match = input.match(/^(\d+)de(\d+)$/);
  if (match) {
      return { inicio: parseInt(match[1], 10), final: parseInt(match[2], 10) };
  } else {
      throw "Formato inválido. Debe ser algo como '5de16'."
  }
}