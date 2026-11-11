import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Capturas compartidas de la réplica del Excel ("Hoja!A1" -> texto capturado). */
export type EstadoLibro = {
  capturas: Record<string, string>;
  /** Formato por celda ("Hoja!A1" -> JSON del estilo parcial). */
  formatos: Record<string, string>;
  /** Operaciones de columna (insertar/eliminar) como JSON; null si nunca se guardó. */
  estructura: string | null;
  /** null cuando nunca se ha guardado. */
  version: number | null;
  actualizado: string | null;
  pestanasPersonalizadas: PestanaPersonalizada[];
  ordenPestanas: string[];
};

export type PestanaPersonalizada = { id: string; nombre: string };

/** Cuerpo de un 409: otro equipo guardó antes; trae el estado vigente. */
export type ConflictoLibro = { error: string; actual: EstadoLibro };

@Injectable({ providedIn: 'root' })
export class BoletosLibroApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/boletos/libro`;

  estado(): Observable<EstadoLibro> {
    return this.http.get<EstadoLibro>(this.url);
  }

  guardar(
    capturas: Record<string, string>,
    formatos: Record<string, string>,
    estructura: string,
    pestanasPersonalizadas: PestanaPersonalizada[],
    ordenPestanas: string[],
    version: number | null,
  ): Observable<EstadoLibro> {
    return this.http.put<EstadoLibro>(this.url, { capturas, formatos, estructura, pestanasPersonalizadas, ordenPestanas, version });
  }
}
