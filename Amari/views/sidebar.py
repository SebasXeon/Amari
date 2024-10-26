import reflex as rx

from .. import styles

from ..backend.docReader import State as docState

def sidebar():
    return rx.box(
        rx.vstack(
            rx.button(
                "Upload",
                on_click=docState.parsePDF()
            ),
            width="100%",
            height="100%",
            spacing="0",

        ),
        display=["none", "none", "none", "block"],
        width=styles.sidebar_width,
        height="100vh",
        position="sticky",
        top="0px",
        left="0px",
        bg=styles.sidebar_bg,
        border_right=styles.border,
    )