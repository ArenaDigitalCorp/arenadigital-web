import { useState, useEffect } from "react";
import { StandardModal } from "@/components/ui/standard-modal";
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
import { STRONG_PASSWORD_HELP } from "@/lib/password-policy";

type UserFormData = {
    name: string;
    email: string;
    senha: string;
    role: string;
    stationId: string;
    status: string;
};

type EditableArenaUser = {
    name?: string | null;
    email?: string | null;
    role?: string | null;
    stationId?: string | null;
    status?: string | null;
};

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: EditableArenaUser | null;
    stations: Array<{ id: string; name: string }>;
    onSave: (data: UserFormData) => Promise<void>;
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

    const formId = "user-form";

    return (
        <StandardModal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            title={isEditMode ? "Editar usuário" : "Novo usuário"}
            footer={
                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        className="bg-white border-arena-navy-800 text-arena-navy-800 hover:bg-slate-50 font-semibold px-8 rounded-lg"
                        disabled={isLoading}
                    >
                        Fechar
                    </Button>
                    <Button
                        type="submit"
                        form={formId}
                        className="bg-arena-button hover:bg-arena-button-hover text-white font-semibold px-8 rounded-lg border-0"
                        disabled={isLoading}
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditMode ? "Salvar" : "Cadastrar")}
                    </Button>
                </div>
            }
        >
            <form id={formId} onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-sm font-medium text-arena-navy-800">Nome</Label>
                            <Input
                                id="name"
                                placeholder="Informa o nome do usuário"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="bg-white border-slate-300 text-slate-800 w-full placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-sm font-medium text-arena-navy-800">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Informa o e-mail do usuário"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="bg-white border-slate-300 text-slate-800 w-full placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                                required
                            />
                        </div>

                        {!isEditMode && <div className="space-y-1.5">
                            <Label htmlFor="senha" className="text-sm font-medium text-arena-navy-800">Senha</Label>
                            <div className="relative">
                                <Input
                                    id="senha"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Crie uma senha segura"
                                    value={formData.senha}
                                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                    className="bg-white border-slate-300 text-slate-800 w-full pr-10 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                                    minLength={8}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">{STRONG_PASSWORD_HELP}</p>
                        </div>}

                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-sm font-medium text-arena-navy-800">Perfil</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) => setFormData({ ...formData, role: value, stationId: value === "Caixa" ? formData.stationId : "" })}
                            >
                                <SelectTrigger className="bg-white border-slate-300 text-slate-800 w-full focus-visible:ring-1 focus-visible:ring-slate-400">
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
                                <Label htmlFor="stationId" className="text-sm font-medium text-arena-navy-800">Estação vinculada</Label>
                                <Select
                                    value={formData.stationId}
                                    onValueChange={(value) => setFormData({ ...formData, stationId: value })}
                                >
                                    <SelectTrigger className="bg-white border-slate-300 text-slate-800 w-full focus-visible:ring-1 focus-visible:ring-slate-400">
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
            </form>
        </StandardModal>
    );
}
