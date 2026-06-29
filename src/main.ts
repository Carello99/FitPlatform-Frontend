// Punto di ingresso dell'applicazione Angular.
// Questo è il primo file che viene eseguito quando il browser carica l'app.

// bootstrapApplication avvia l'app senza NgModule (approccio "standalone" moderno)
import { bootstrapApplication } from '@angular/platform-browser';
// appConfig contiene i "providers" globali (router, http client, ecc.)
import { appConfig } from './app/app.config';
// AppComponent è il componente radice: la "radice" dell'albero di componenti
import { AppComponent } from './app/app.component';

// Avvia l'applicazione: monta AppComponent nel DOM (nel tag <ff-root> di index.html)
// e applica la configurazione globale. .catch cattura eventuali errori di bootstrap.
bootstrapApplication(AppComponent, appConfig).catch((err: unknown) =>
  console.error(err),
);
