import { useState } from "react";
import type { AccessProfile } from "@/modules/access/types";
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
    profileId: string;
    stationId: string;
    status: string;
};

type EditableArenaUser = {
    name?: string | null;
    email?: string | null;
    profileId?: string | null;
    stationId?: string | null;
    status?: string | null;
};

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: EditableArenaUser | null;
    profiles: AccessProfile[];
    stations: Array<{ id: string; name: string }>;
    onSave: (data: UserFormData) => Promise<void>;
}

export function UserFormModal(props: UserFormModalProps) {
    return props.isOpen ? <UserForm {...props} /> : null;
}

function UserForm({ isOpen, onClose, user, profiles, stations, onSave }: UserFormModalProps) {
    const isEditMode = !!user;

    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [formData, setFormData] = useState({
        name: user?.name ?? "",
        email: user?.email ?? "",
        senha: "",
        profileId: user?.profileId ?? profiles.find(p => p.base_role === 'Atendente' && p.is_default)?.id ?? profiles[0]?.id ?? "",
        stationId: user?.stationId ?? "",
        status: user?.status && ['inativo','inactive'].includes(user.status.toLowerCase()) ? "Inativo" : "Ativo",
    });
    const profile = profiles.find(p => p.id === formData.profileId);

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
                                readOnly={isEditMode}
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
                                readOnly={isEditMode}
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
                                    placeholder="Senha inicial de uma conta nova"
                                    value={formData.senha}
                                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                    className="bg-white border-slate-300 text-slate-800 w-full pr-10 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400"
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500">Para contas existentes, deixe em branco. {STRONG_PASSWORD_HELP}</p>
                        </div>}

                        <div className="space-y-1.5">
                            <Label htmlFor="role" className="text-sm font-medium text-arena-navy-800">Perfil</Label>
                            <Select
                                value={formData.profileId}
                                onValueChange={(value) => setFormData({ ...formData, profileId: value, stationId: profiles.find(p => p.id === value)?.base_role === "Caixa" ? formData.stationId : "" })}
                            >
                                <SelectTrigger id="role" className="bg-white border-slate-300 text-slate-800 w-full focus-visible:ring-1 focus-visible:ring-slate-400">
                                    <SelectValue placeholder="Selecione o perfil" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-800 rounded-xl shadow-lg">
                                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {isEditMode && <label className="block space-y-1.5 text-sm font-medium">Status
                            <select className="block h-9 w-full rounded border border-slate-300 px-3" value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                <option>Ativo</option><option>Inativo</option>
                            </select>
                        </label>}
                        {profile?.base_role === "Caixa" && (
                            <div className="space-y-1.5">
                                <Label htmlFor="stationId" className="text-sm font-medium text-arena-navy-800">Estação vinculada</Label>
                                <Select
                                    value={formData.stationId}
                                    onValueChange={(value) => setFormData({ ...formData, stationId: value })}
                                >
                                    <SelectTrigger id="stationId" className="bg-white border-slate-300 text-slate-800 w-full focus-visible:ring-1 focus-visible:ring-slate-400">
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
