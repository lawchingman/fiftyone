import React, { useState } from "react";
import { animated } from "react-spring";
import styled from "styled-components";
import { useRecoilValue, useRecoilState } from "recoil";
import {
  BarChart,
  Check,
  Close,
  Help,
  Label,
  PhotoLibrary,
} from "@material-ui/icons";

import CellHeader from "./CellHeader";
import CheckboxGrid from "./CheckboxGroup";
import DropdownCell from "./DropdownCell";
import SelectionTag from "./Tags/SelectionTag";
import { Entry } from "./CheckboxGroup";
import * as fieldAtoms from "./Filters/utils";
import * as labelAtoms from "./Filters/LabelFieldFilters.state";
import * as selectors from "../recoil/selectors";
import { stringify, FILTERABLE_TYPES } from "../utils/labels";

const Container = styled.div`
  .MuiCheckbox-root {
    padding: 4px 8px 4px 4px;
  }

  ${CellHeader.Body} {
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.fontDark};

    * {
      display: flex;
    }

    .label {
      text-transform: uppercase;
    }

    ${SelectionTag.Body} {
      float: right;
    }

    .push {
      margin-left: auto;
    }
    .icon {
      margin-left: 2px;
    }
  }

  .left-icon {
    margin-right: 4px;
  }
`;

type CellProps = {
  label: string;
  title: string;
  modal: boolean;
  onSelect: (entry: Entry) => void;
  handleClear: (event: Event) => void;
  entries: Entry[];
  icon: any;
};

const Cell = ({
  label,
  icon,
  entries,
  handleClear,
  onSelect,
  title,
  modal,
}: CellProps) => {
  const [expanded, setExpanded] = useState(true);
  const numSelected = entries.filter((e) => e.selected).length;

  return (
    <DropdownCell
      label={
        <>
          {icon ? <span className="left-icon">{icon}</span> : null}
          <span className="label">{label}</span>
          <span className="push" />
          {numSelected ? (
            <SelectionTag
              count={numSelected}
              title="Clear selection"
              onClear={handleClear}
              onClick={handleClear}
            />
          ) : null}
        </>
      }
      title={title}
      expanded={expanded}
      onExpand={setExpanded}
    >
      {label === "Options" && <RefreshButton />}
      {entries.length ? (
        <CheckboxGrid entries={entries} onCheck={onSelect} modal={modal} />
      ) : (
        <span>No options available</span>
      )}
    </DropdownCell>
  );
};

const makeData = (filteredCount: number, totalCount: number): string => {
  if (
    typeof filteredCount === "number" &&
    filteredCount !== totalCount &&
    typeof totalCount === "number"
  ) {
    return `${filteredCount.toLocaleString()} of ${totalCount.toLocaleString()}`;
  } else if (filteredCount === null) {
    return null;
  } else if (typeof totalCount === "number") {
    return totalCount.toLocaleString();
  }
  return totalCount;
};

type TagsCellProps = {
  modal: boolean;
};

const TagsCell = ({ modal }: TagsCellProps) => {
  const tags = useRecoilValue(selectors.tagNames);
  const [activeTags, setActiveTags] = useRecoilState(
    fieldAtoms.activeTags(modal)
  );
  const colorMap = useRecoilValue(selectors.colorMap);
  const [subCountAtom, countAtom] = modal
    ? [null, selectors.tagSampleModalCounts]
    : [selectors.filteredTagSampleCounts, selectors.tagSampleCounts];

  const subCount = subCountAtom ? useRecoilValue(subCountAtom) : null;
  const count = useRecoilValue(countAtom);

  return (
    <Cell
      label="Tags"
      icon={<PhotoLibrary />}
      entries={tags.map((name) => ({
        name,
        disabled: false,
        hideCheckbox: modal,
        hasDropdown: false,
        selected: activeTags.includes(name),
        color: colorMap[name],
        title: name,
        path: name,
        data: modal ? (
          count[name] > 0 ? (
            <Check style={{ color: colorMap[name] }} />
          ) : (
            <Close style={{ color: colorMap[name] }} />
          )
        ) : (
          makeData(subCount[name], count[name])
        ),
        totalCount: count[name],
        filteredCount: modal ? null : subCount[name],
        modal,
      }))}
      onSelect={({ name, selected }) =>
        setActiveTags(
          selected
            ? [name, ...activeTags]
            : activeTags.filter((t) => t !== name)
        )
      }
      handleClear={(e) => {
        e.stopPropagation();
        setActiveTags([]);
      }}
      modal={modal}
      title={"Tags"}
    />
  );
};

type LabelsCellProps = {
  modal: boolean;
  frames: boolean;
};

const LabelsCell = ({ modal, frames }: LabelsCellProps) => {
  const key = frames ? "frame" : "sample";
  const labels = useRecoilValue(selectors.labelNames(key));
  const [activeLabels, setActiveLabels] = useRecoilState(
    fieldAtoms.activeLabels({ modal, frames })
  );
  const types = useRecoilValue(selectors.labelTypesMap);

  const colorMap = useRecoilValue(selectors.colorMap);
  const [subCountAtom, countAtom] = modal
    ? [
        labelAtoms.filteredLabelSampleModalCounts(key),
        labelAtoms.labelSampleModalCounts(key),
      ]
    : [
        labelAtoms.filteredLabelSampleCounts(key),
        labelAtoms.labelSampleCounts(key),
      ];

  const subCount = subCountAtom ? useRecoilValue(subCountAtom) : null;
  const count = useRecoilValue(countAtom);

  return (
    <Cell
      label={frames ? "Frame Labels" : "Labels"}
      icon={
        frames ? (
          <PhotoLibrary />
        ) : (
          <Label style={{ transform: "rotate(180deg)" }} />
        )
      }
      entries={labels.map((name) => {
        const path = frames ? "frames." + name : name;
        return {
          name,
          disabled: false,
          hideCheckbox: false,
          hasDropdown: FILTERABLE_TYPES.includes(types[path]),
          selected: activeLabels.includes(path),
          color: colorMap[path],
          title: name,
          path,
          data:
            count && subCount ? makeData(subCount[name], count[name]) : null,
          totalCount: count ? count[name] : null,
          filteredCount: subCount ? subCount[name] : null,
          modal,
          labelType: types[path],
          canFilter: true,
        };
      })}
      onSelect={({ name, selected }) =>
        setActiveLabels(
          selected
            ? [name, ...activeLabels]
            : activeLabels.filter((t) => t !== name)
        )
      }
      handleClear={(e) => {
        e.stopPropagation();
        setActiveLabels([]);
      }}
      modal={modal}
      title={frames ? "Frame Labels" : "Labels"}
    />
  );
};

type ScalarsCellProps = {
  modal: boolean;
};

const ScalarsCell = ({ modal }: ScalarsCellProps) => {
  const scalars = useRecoilValue(selectors.scalarNames("sample"));
  const [activeScalars, setActiveScalars] = useRecoilState(
    fieldAtoms.activeScalars(modal)
  );

  const colorMap = useRecoilValue(selectors.colorMap);
  const [subCountAtom, countAtom] = modal
    ? [null, selectors.modalSample]
    : [
        labelAtoms.filteredLabelSampleCounts("sample"),
        labelAtoms.labelSampleCounts("sample"),
      ];

  const subCount = subCountAtom ? useRecoilValue(subCountAtom) : null;
  const count = useRecoilValue(countAtom);

  return (
    <Cell
      label="Scalars"
      icon={<BarChart />}
      entries={scalars.map((name) => ({
        name,
        disabled: false,
        hideCheckbox: modal,
        hasDropdown: !modal,
        selected: activeScalars.includes(name),
        color: colorMap[name],
        title: name,
        path: name,
        data:
          count && subCount && !modal
            ? makeData(subCount[name], count[name])
            : modal
            ? stringify(count[name])
            : null,
        totalCount: !modal && count ? count[name] : null,
        filteredCount: !modal && subCount ? subCount[name] : null,
        modal,
        canFilter: !modal,
      }))}
      onSelect={({ name, selected }) =>
        setActiveScalars(
          selected
            ? [name, ...activeScalars]
            : activeScalars.filter((t) => t !== name)
        )
      }
      handleClear={(e) => {
        e.stopPropagation();
        setActiveScalars([]);
      }}
      modal={modal}
      title={"Scalars"}
    />
  );
};

type UnsupportedCellProps = {
  modal: boolean;
};

const UnsupportedCell = ({ modal }: UnsupportedCellProps) => {
  const unsupported = useRecoilValue(fieldAtoms.unsupportedFields);
  return (
    <Cell
      label={"Unsupported"}
      icon={<Help />}
      entries={unsupported.map((e) => ({
        name: e,
        data: null,
        disabled: true,
        hideCheckbox: true,
        selected: false,
      }))}
      modal={modal}
    />
  );
};

type FieldsSidebarProps = {
  modal: boolean;
  style: object;
};

const FieldsSidebar = React.forwardRef(
  ({ modal, style }: FieldsSidebarProps, ref) => {
    const mediaType = useRecoilValue(selectors.mediaType);
    const isVideo = mediaType === "video";

    return (
      <Container ref={ref} style={style}>
        <TagsCell modal={modal} />
        <LabelsCell modal={modal} frames={false} />
        {isVideo && <LabelsCell modal={modal} frames={true} />}
        <ScalarsCell modal={modal} />
        <UnsupportedCell />
      </Container>
    );
  }
);

export default FieldsSidebar;
