import {login} from "./script.js";

const reg_button = document.querySelector(".sign_form_link_inner");
const sign_form = document.querySelector(".sign_form")
const registration_form = document.querySelector(".registration_form");
const sign_button = document.querySelector(".reg_form_link_inner");
const reg_username = document.getElementById('username_sign')
const reg_password = document.getElementById('password_sign')
const username = document.getElementById('username')
const password = document.getElementById('password')
const mail = document.getElementById('mail')
const signup = document.querySelector('.sign_form_button')

document.addEventListener("DOMContentLoaded", () => {
    const accessToken = sessionStorage.getItem("accessToken")
    const refreshToken = sessionStorage.getItem("refreshToken")

    if (!accessToken && !refreshToken) {
        sign_form.style.display = "flex";
    }
})
reg_button.addEventListener("click", () => {
    sign_form.style.display = "none"
    registration_form.style.display = "flex"
    reg_username.value = ''
    reg_password.value = ''
})

sign_button.addEventListener("click", () => {
    registration_form.style.display = "none"
    sign_form.style.display = "flex"
    username.value = ''
    password.value = ''
    mail.value = ''
})

signup.addEventListener("click", (e) => {
    e.preventDefault()
    login()
})
