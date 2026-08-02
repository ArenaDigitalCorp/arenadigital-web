export interface StationType {
    id: string;
    name: string;
}

export interface StationOrderItem {
    id: string;
    order_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    created_at: string;
    product?: { name: string };
}

export interface StationOrderPayment {
    id: string;
    order_id: string;
    paid_by_name?: string;
    payment_method: string;
    observation?: string;
    amount: number;
    created_at: string;
}

export interface StationOrdersFilters {
    page?: number;
    pageSize?: number;
    status?: 'open' | 'pending' | 'closed' | 'todos';
    /** Busca por cliente (customer_name ou atleta.nome_perfil) e nº da comanda. */
    search?: string;
    /** ISO timestamp (inclusive) — comandas abertas a partir desta data. */
    dateFrom?: string;
    /** ISO timestamp (inclusive) — comandas abertas até esta data. */
    dateTo?: string;
}

export interface StationOrder {
    id: string;
    arena_id: string;
    station_id: string;
    /** Preenchido quando a query inclui `station:stations(...)`. */
    station?: { name?: string; station_type_id: string | null } | null;
    atleta_id?: string;
    customer_id?: string;
    order_number: number;
    customer_name?: string;
    status: 'open' | 'pending' | 'closed' | 'cancelled';
    total_value: number;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    pending_marked_at?: string | null;
    station_order_items?: StationOrderItem[];
    station_payments?: StationOrderPayment[];
    atleta?: { nome_perfil: string; telefone?: string | null; cpf?: string | null };
    station_customer?: { name: string; phone?: string | null; cpf?: string | null };
}

export interface OrderPrintArena {
    name: string;
    phone?: string | null;
    cpfCnpj: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    stateUf: string | null;
}
