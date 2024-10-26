import reflex as rx

class State(rx.State):
    documentMkd = ""


    def parsePDF():
        with open("assets/test") as f:
            documentMkd = f.readlines()