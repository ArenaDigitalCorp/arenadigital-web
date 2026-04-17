import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: any; // To be typed properly later
    stations: Array<{ id: string; name: string }>;
    onSave: (data: any) => Promise<void>;
}

export function UserFormModal({ isOpen, onClose, user, stations, onSave }: UserFormModalProps) {
    const isEditMode = !!user;

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Note: status is not in the layout, we keep it as "Ativo" hidden
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        senha: "",
        role: "Atendente",
        stationId: "",
        status: "Ativo"
    });

    useEffect(() => {
        if (user && isOpen) {
            setFormData({
                name: user.name || "",
                email: user.email || "",
                senha: "", // always empty on edit
                role: user.role || "Atendente",
                stationId: user.stationId || "",
                status: user.status || "Ativo",
            });
            setShowPassword(false);
        } else if (isOpen) {
            setFormData({
                name: "",
                email: "",
                senha: "",
                role: "Atendente",
                stationId: "",
                status: "Ativo"
            });
            setShowPassword(false);
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onSave(formData);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 text-slate-800 p-6 rounded-3xl shadow-xl">
                <DialogHeader className="mb-2">
                    <DialogTitle className="text-[#002B40] text-2xl font-semibold">
                        {isEditMode ? "Editar usuário" : "Novo usuário"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-[#0089A0] text-sm font-medium">Nome</Label>
                            <Input
                                id="name"
                                placeholder="Informa o nome do usuário"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-white border-slate-300 text-slate-800 w-full placeholder:text-slate-400 focus-visible:ring-[#0089A0]"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-[#0089A0] text-sm font-medium">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Informa o e-mail do usuário"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="bg-white border-slate-300 text-slate-800 w-full placeholder:text-slate-400 focus-visible:ring-[#0089A0]"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="senha" className="text-[#0089A0] text-sm font-medium">Senha</Label>
                            <div className="relative">
                                <Input
                                    id="senha"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Insira uma senha para acesso do usuário com 6 dígitos"
                                    value={formData.senha}
                                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                    className="bg-white border-slate-300 text-slate-800 w-full pr-10 placeholder:text-slate-400 focus-visible:ring-[#0089A0]"
                                    minLength={6}
                                    required={!isEditMode}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-[#0089A0] text-sm font-medium">Perfil</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value, stationId: value === "Caixa" ? formData.stationId : "" })}
                            >
                                <SelectTrigger className="bg-white border-slate-300 text-slate-800 w-full focus:ring-[#0089A0]">
                                    <SelectValue placeholder="Selecione o perfil" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
                                    <SelectItem value="Gestor" className="hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900">Administrador</SelectItem>
                                    <SelectItem value="Atendente" className="hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900">Usuário comum</SelectItem>
                                    <SelectItem value="Caixa" className="hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900">Caixa</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {formData.role === "Caixa" && (
                            <div className="space-y-1.5">
                                <Label htmlFor="stationId" className="text-[#0089A0] text-sm font-medium">Estação vinculada</Label>
                                <Select
                                    value={formData.stationId}
                                    onValueChange={(value) => setFormData({ ...formData, stationId: value })}
                                >
                                    <SelectTrigger className="bg-white border-slate-300 text-slate-800 w-full focus:ring-[#0089A0]">
                                        <SelectValue placeholder="Selecione a estação" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
                                        {stations.map((station) => (
                                            <SelectItem key={station.id} value={station.id} className="hover:bg-slate-100 cursor-pointer focus:bg-slate-100 focus:text-slate-900">
                                                {station.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="bg-white border-[#002B40] text-[#002B40] hover:bg-slate-50 font-semibold px-8 rounded-lg"
                            disabled={isLoading}
                        >
                            Fechar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-semibold px-8 rounded-lg border-0"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditMode ? "Salvar" : "Cadastrar")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
