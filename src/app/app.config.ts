import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { BackendSyncService } from './data/backend-api.service';

const loadBackendState = (sync: BackendSyncService) => async () => {
  try {
    const state = await firstValueFrom(sync.loadFromBackend());
    sync.syncLocalState(state);
  } catch {
    // Local-only mode if backend is unavailable.
  }
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [BackendSyncService],
      useFactory: loadBackendState,
    },
  ],
};
