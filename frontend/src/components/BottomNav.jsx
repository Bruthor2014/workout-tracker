import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconCalendar,
  IconUtensils,
  IconPlusCircle,
  IconUsers,
  IconUser,
  IconUserPlus,
  IconMessage,
  IconBuilding,
  IconClock,
  IconClipboard,
  IconBarChart,
} from "./Icons";
import { useSidebarMode } from "../hooks/useSidebarMode";

// Navegação pessoal (membro, ou staff-pessoa em modo "Pessoal") — os
// destinos mais frequentes para quem usa a app para treinar. "Os teus
// treinos" (dashboard) deixou de ter aba própria — acede-se pelo logótipo
// no topo — para o "Treino" ficar centrado na barra. "Amigos" aparece
// sempre (a centragem não depende de ter o mesmo nº de itens dos dois
// lados — ver o split antes/depois do "primary" mais abaixo). Sem "Aulas"
// (conta sem ginásio), o "Perfil" ocupa esse lugar.
function personalItems(user) {
  const items = [
    { to: "/plans", label: "Planos", icon: IconCalendar },
    { to: "/nutrition", label: "Nutrição", icon: IconUtensils },
    { to: "/log", label: "Treino", icon: IconPlusCircle, primary: true },
  ];
  if (user?.gym_id) items.push({ to: "/classes", label: "Aulas", icon: IconUsers });
  items.push({ to: "/friends", label: "Amigos", icon: IconUserPlus });
  items.push({ to: "/messages", label: "Mensagens", icon: IconMessage });
  if (!user?.gym_id) items.push({ to: "/profile", label: "Perfil", icon: IconUser });
  return items;
}

// Navegação profissional de quem é staff-pessoa (PT, nutricionista,
// rececionista, estagiário) — os destinos de trabalho mais usados.
function staffProfessionalItems(role) {
  const items = [];
  if (role === "personal_trainer" || role === "nutritionist") {
    items.push({ to: "/clients", label: "Clientes", icon: IconClipboard });
  }
  items.push({ to: "/classes", label: "Aulas", icon: IconCalendar });
  items.push({ to: "/schedule", label: "Horário", icon: IconClock });
  if (role === "receptionist") items.push({ to: "/occupancy", label: "Ocupação", icon: IconClipboard });
  items.push({ to: "/team", label: "Equipa", icon: IconBuilding });
  items.push({ to: "/members", label: "Membros", icon: IconUsers });
  items.push({ to: "/messages", label: "Mensagens", icon: IconMessage });
  return items.slice(0, 6);
}

function ownerItems() {
  return [
    { to: "/management", label: "Gestão", icon: IconBuilding },
    { to: "/members", label: "Membros", icon: IconUsers },
    { to: "/classes", label: "Aulas", icon: IconCalendar },
    { to: "/team-schedule", label: "Horários", icon: IconClock },
    { to: "/finance", label: "Financeiro", icon: IconBarChart },
    { to: "/messages", label: "Mensagens", icon: IconMessage },
  ];
}

function receptionStationItems() {
  return [
    { to: "/classes", label: "Aulas", icon: IconCalendar },
    { to: "/occupancy", label: "Ocupação", icon: IconClipboard },
    { to: "/members", label: "Membros", icon: IconUsers },
    { to: "/team-schedule", label: "Horário", icon: IconClock },
    { to: "/messages", label: "Mensagens", icon: IconMessage },
  ];
}

function donoItems() {
  return [
    { to: "/dono", label: "Ginásios", icon: IconBuilding },
    { to: "/messages", label: "Mensagens", icon: IconMessage },
  ];
}

// Barra de navegação fixa em baixo, só visível em ecrãs estreitos (ver
// @media em App.css) — os atalhos mais frequentes; a navegação completa
// (incluindo o toggle Pessoal/Profissional) continua na Sidebar, acessível
// em mobile através da gaveta aberta pelo botão de hambúrguer. O role
// "fonte da verdade" dos itens é o mesmo que a Sidebar usa, só condensado.
export default function BottomNav() {
  const { user } = useAuth();
  const isReceptionStation = user?.role === "reception_station";
  const { mode, isOwner, isDono, isStaffPerson } = useSidebarMode(user);

  if (!user) return null;

  let items;
  if (isReceptionStation) items = receptionStationItems();
  else if (isDono) items = mode === "individual" ? personalItems(user) : donoItems();
  else if (isOwner) items = mode === "individual" ? personalItems(user) : ownerItems();
  else if (isStaffPerson) items = mode === "individual" ? personalItems(user) : staffProfessionalItems(user.role);
  else items = personalItems(user);

  function renderLink(item) {
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) => `bottom-nav-link${isActive ? " active" : ""}${item.primary ? " primary" : ""}`}
      >
        <span className="bottom-nav-icon">
          <item.icon size={item.primary ? 26 : 22} />
        </span>
        <span className="bottom-nav-label">{item.label}</span>
      </NavLink>
    );
  }

  // O item "primary" (ex: "Treino") fica sempre mesmo ao centro da barra,
  // independentemente de quantos itens há de cada lado — ex: contas sem
  // ginásio não têm "Aulas", mas o "Treino" não pode deixar de estar no
  // meio. Em vez de confiar numa distribuição flex uniforme (que só
  // centra por acaso quando os dois lados têm o mesmo nº de itens), os
  // itens antes/depois do "primary" ficam cada um no seu próprio grupo de
  // largura igual, com o "primary" fixo entre os dois.
  const primaryIndex = items.findIndex((item) => item.primary);
  if (primaryIndex === -1) {
    return (
      <nav className="bottom-nav" aria-label="Navegação principal">
        {items.map(renderLink)}
      </nav>
    );
  }
  const before = items.slice(0, primaryIndex);
  const primary = items[primaryIndex];
  const after = items.slice(primaryIndex + 1);

  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav-group">{before.map(renderLink)}</div>
      <div className="bottom-nav-group bottom-nav-group-center">{renderLink(primary)}</div>
      <div className="bottom-nav-group">{after.map(renderLink)}</div>
    </nav>
  );
}
