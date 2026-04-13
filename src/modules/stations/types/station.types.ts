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

export interface StationOrder {
    id: string;
    arena_id: string;
    station_id: string;
    atleta_id?: string;
    customer_id?: string;
    order_number: number;
    customer_name?: string;
    status: 'open' | 'closed' | 'cancelled';
    total_value: number;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    station_order_items?: StationOrderItem[];
    station_payments?: StationOrderPayment[];
    atleta?: { nome_perfil: string };
    station_customer?: { name: string };
}
