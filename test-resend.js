const { Resend } = require('resend');
require('dotenv').config();
const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
    const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: ['prathamesh@intrface.in', 'arya@intrface.in'],
        subject: 'Test',
        html: '<p>Test</p>'
    });
    console.log({ data, error });
}
test();
