import reflex as rx
from ..views.sidebar import sidebar
from ..views.visualizer import visualizer


@rx.page(
    "/reader",
    title="PDF to mkd reader",
    description="Render a given PDF to a markdown based reader",
)
def reader():
    return rx.flex(
        sidebar(),
        rx.container(
            visualizer()
        )
    )