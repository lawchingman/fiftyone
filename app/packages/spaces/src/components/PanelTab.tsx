import { IconButton } from "@fiftyone/components";
import { Close, Check } from "@mui/icons-material";
import {
  usePanel,
  usePanelCloseEffect,
  usePanelFilterStats,
  usePanelTitle,
  useSpaces,
} from "../hooks";
import { PanelTabProps } from "../types";
import { warnPanelNotFound } from "../utils";
import PanelIcon from "./PanelIcon";
import { StyledTab } from "./StyledElements";
import { PillButton } from "@fiftyone/components";

export default function PanelTab({ node, active, spaceId }: PanelTabProps) {
  const { spaces } = useSpaces(spaceId);
  const panelName = node.type;
  const panelId = node.id;
  const panel = usePanel(panelName);
  const [title] = usePanelTitle(panelId);
  const closeEffect = usePanelCloseEffect(panelId);
  const [panelFilterStats, _, handler] = usePanelFilterStats(panelId);

  if (!panel) return warnPanelNotFound(panelName);

  return (
    <StyledTab
      onClick={() => {
        if (!active) spaces.setNodeActive(node);
      }}
      active={active}
    >
      <PanelIcon name={panelName as string} />
      {title || panel.label || panel.name}
      {panelFilterStats && (
        <PillButton
          text={panelFilterStats.caption}
          icon={<Check sx={{ fontSize: "1rem" }} />}
          style={{
            height: "1.5rem",
            fontSize: "0.8rem",
            lineHeight: "1rem",
            padding: "0.25rem 0.5rem",
            marginLeft: "0.5rem",
          }}
          title={panelFilterStats.title}
          onClick={(e) => {
            e.stopPropagation();
            handler();
          }}
        />
      )}
      {!node.pinned && (
        <IconButton
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeEffect();
            spaces.removeNode(node);
          }}
          sx={{ pb: 0, mr: "-8px" }}
          title="Close"
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </StyledTab>
  );
}
