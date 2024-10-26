import reflex as rx


from ..backend.docReader import State as docState
from .. import styles

def visualizer():
    return rx.box(
        rx.markdown(docState.documentMkd)
    )