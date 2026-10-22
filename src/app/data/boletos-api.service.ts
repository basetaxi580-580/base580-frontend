import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

export type TipoBoleto = 'sencillo' | 'doble' | 'nocturno';

export type TicketTariff = {
  id?: string;
  base: string;
  vigencia: string;
  ambito: string;
  tipo: TipoBoleto;
  zona: string;
  precio: number;
  descuento: number;
  sitio: number;
  plata: number | null;
  neto: number;
  clave?: string;
  orden?: number | null;
};

export type TicketSettlementLine = {
  base?: string;
  vigencia?: string;
  ambito?: string;
  zona: string;
  tipo: TipoBoleto;
  cantidad: number;
  precio: number;
  descuento: number;
  sitio: number;
  plata: number | null;
  neto: number;
  importe: number;
  manual?: boolean;
  clave?: string;
};

export type TicketSettlement = {
  id: string;
  base: string;
  vigencia: string;
  ambito: string;
  placas: string;
  nombre: string;
  lineas: TicketSettlementLine[];
  servicios: number;
  conteo: number;
  importe: number;
  sinAhorro: number;
  sencillo: number;
  doble: number;
  triple: number;
  cuadruple?: number;
  quintuple?: number;
  septuple?: number;
  manualesEditados?: boolean;
  savedAt?: string;
};

export type TicketSettlementInput = {
  placas: string;
  nombre: string;
  manualesEditados: boolean;
  lineas: Array<{
    base: string;
    vigencia: string;
    ambito: string;
    zona: string;
    tipo: TipoBoleto;
    cantidad: number;
    precio: number;
    descuento: number;
    sitio: number;
    plata: number | null;
    neto: number;
    importe: number;
    manual: boolean;
    clave: string;
  }>;
};

@Injectable({ providedIn: 'root' })
export class BoletosApiService {
  private readonly http = inject(HttpClient);

  tarifas() {
    return this.http.get<TicketTariff[]>(`${environment.apiUrl}/boletos/tarifas`);
  }

  cortes() {
    return this.http.get<TicketSettlement[]>(`${environment.apiUrl}/boletos/cortes`);
  }

  corte(id: string) {
    return this.http.get<TicketSettlement>(`${environment.apiUrl}/boletos/cortes/${id}`);
  }

  crearCorte(input: TicketSettlementInput) {
    return this.http.post<TicketSettlement>(`${environment.apiUrl}/boletos/cortes`, input);
  }

  actualizarCorte(id: string, input: TicketSettlementInput) {
    return this.http.put<TicketSettlement>(`${environment.apiUrl}/boletos/cortes/${id}`, input);
  }
}
