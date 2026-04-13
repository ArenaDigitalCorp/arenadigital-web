export type DashboardStats = {
    receita: number;
    receitaChange: number;
    reservas: number;
    quadras: number;
    ativos: number;
};

export type OccupancyRow = {
    courtName: string;
    percentage: number;
    booked: number;
    total: number;
};
