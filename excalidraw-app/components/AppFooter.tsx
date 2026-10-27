import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDesktopApp, isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {/* links to Excalidraw+'s blog; boards in the desktop app are local */}
          {!isExcalidrawPlusSignedUser && !isDesktopApp && <EncryptedIcon />}
        </div>
      </Footer>
    );
  },
);
